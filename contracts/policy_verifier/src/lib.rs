#![no_std]
use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, symbol_short, Address, Bytes, BytesN,
    Env, IntoVal, InvokeError, Map, Symbol, Vec,
};
use stellar_access::access_control::{grant_role_no_auth, set_admin, AccessControl};
use stellar_macros::only_role;
use ultrahonk_soroban_verifier::PROOF_BYTES;

#[contract]
pub struct PolicyVerifier;

#[contracterror]
#[repr(u32)]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum Error {
    NotAdmin = 1,
    PolicyNotFound = 2,
    ProofParseError = 3,
    VerifierInvalid = 4,
    VerificationFailed = 5,
    NullifierSpent = 6,
    InvalidPublicInputs = 7,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PolicyRegistered {
    pub policy_id: u32,
    pub verifier: Address,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EligibilityVerified {
    pub holder: Address,
    pub policy_id: u32,
    pub nullifier: BytesN<32>,
}

#[contractimpl]
impl PolicyVerifier {
    pub fn __constructor(env: Env, admin: Address) {
        set_admin(&env, &admin);
        grant_role_no_auth(&env, &admin, &Symbol::new(&env, "policy_admin"), &admin);
    }

    fn policy_verifiers(env: &Env) -> Map<u32, Address> {
        env.storage()
            .persistent()
            .get(&Symbol::new(env, "verifiers"))
            .unwrap_or(Map::new(env))
    }

    fn save_verifiers(env: &Env, verifiers: &Map<u32, Address>) {
        env.storage()
            .persistent()
            .set(&Symbol::new(env, "verifiers"), verifiers);
    }

    fn spent_key(
        policy_id: u32,
        asset_id: u32,
        action_id: u32,
        nullifier: &BytesN<32>,
    ) -> (u32, u32, u32, BytesN<32>) {
        (policy_id, asset_id, action_id, nullifier.clone())
    }

    fn field_bytes_to_u32(bytes: &[u8; 32]) -> u32 {
        let mut value: u128 = 0;
        for b in bytes.iter() {
            value = (value << 8) | (*b as u128);
        }
        if value > u32::MAX as u128 {
            return 0;
        }
        value as u32
    }

    fn public_input_u32(public_inputs: &Bytes, index: u32) -> Result<u32, Error> {
        let start = index * 32;
        let end = start + 32;
        if public_inputs.len() < end {
            return Err(Error::InvalidPublicInputs);
        }
        let slice = public_inputs.slice(start..end);
        let mut arr = [0u8; 32];
        slice.copy_into_slice(&mut arr);
        let value = Self::field_bytes_to_u32(&arr);
        if value == 0 {
            return Err(Error::InvalidPublicInputs);
        }
        Ok(value)
    }

    fn nullifier_from_public_inputs(env: &Env, public_inputs: &Bytes) -> Result<BytesN<32>, Error> {
        let offset = if public_inputs.len() >= 192 { 160 } else { 96 };
        if public_inputs.len() < offset + 32 {
            return Err(Error::InvalidPublicInputs);
        }
        let nullifier_bytes = public_inputs.slice(offset..offset + 32);
        let mut nullifier_arr = [0u8; 32];
        nullifier_bytes.copy_into_slice(&mut nullifier_arr);
        Ok(BytesN::from_array(env, &nullifier_arr))
    }

    fn assert_verifier_has_vk(env: &Env, verifier: &Address) -> Result<(), Error> {
        match env.try_invoke_contract::<Bytes, InvokeError>(
            verifier,
            &Symbol::new(env, "vk_bytes"),
            soroban_sdk::vec![env],
        ) {
            Ok(Ok(_)) => Ok(()),
            _ => Err(Error::VerifierInvalid),
        }
    }

    #[only_role(caller, "policy_admin")]
    pub fn register_policy(
        env: Env,
        caller: Address,
        policy_id: u32,
        verifier: Address,
    ) -> Result<(), Error> {
        Self::assert_verifier_has_vk(&env, &verifier)?;
        let mut verifiers = Self::policy_verifiers(&env);
        verifiers.set(policy_id, verifier.clone());
        Self::save_verifiers(&env, &verifiers);
        PolicyRegistered {
            policy_id,
            verifier,
        }
        .publish(&env);
        Ok(())
    }

    pub fn get_verifier(env: Env, policy_id: u32) -> Result<Address, Error> {
        Self::policy_verifiers(&env)
            .get(policy_id)
            .ok_or(Error::PolicyNotFound)
    }

    fn concat_public_inputs(env: &Env, public_inputs: &Vec<BytesN<32>>) -> Result<Bytes, Error> {
        if public_inputs.is_empty() {
            return Err(Error::InvalidPublicInputs);
        }
        let mut out = Bytes::new(env);
        for pi in public_inputs.iter() {
            out.extend_from_array(&pi.to_array());
        }
        Ok(out)
    }

    fn verify_inner(
        env: Env,
        policy_id: u32,
        proof: Bytes,
        public_inputs: Bytes,
        spend_nullifier: bool,
    ) -> Result<bool, Error> {
        if proof.len() as usize != PROOF_BYTES {
            return Err(Error::ProofParseError);
        }
        if public_inputs.len() as usize % 32 != 0 || public_inputs.len() == 0 {
            return Err(Error::InvalidPublicInputs);
        }
        let verifiers = Self::policy_verifiers(&env);
        let verifier = verifiers.get(policy_id).ok_or(Error::PolicyNotFound)?;

        // Scoped settlement inputs: root, rev_root, policy_id, asset_id, action_id, nullifier.
        // Legacy non-settlement policies such as proof-of-funds remain root, rev_root, policy_id, nullifier.
        let (asset_id, action_id) = if public_inputs.len() >= 192 {
            (
                Self::public_input_u32(&public_inputs, 3)?,
                Self::public_input_u32(&public_inputs, 4)?,
            )
        } else {
            (0, 0)
        };
        let nullifier = Self::nullifier_from_public_inputs(&env, &public_inputs)?;
        if env
            .storage()
            .persistent()
            .get(&Self::spent_key(policy_id, asset_id, action_id, &nullifier))
            .unwrap_or(false)
        {
            return Err(Error::NullifierSpent);
        }

        match env.try_invoke_contract::<(), InvokeError>(
            &verifier,
            &Symbol::new(&env, "verify_proof"),
            soroban_sdk::vec![&env, public_inputs.into_val(&env), proof.into_val(&env),],
        ) {
            Ok(Ok(())) => {}
            _ => return Err(Error::VerificationFailed),
        }

        if spend_nullifier {
            env.storage().persistent().set(
                &Self::spent_key(policy_id, asset_id, action_id, &nullifier),
                &true,
            );
        }

        Ok(true)
    }

    pub fn verify(
        env: Env,
        policy_id: u32,
        proof: Bytes,
        public_inputs: Bytes,
    ) -> Result<bool, Error> {
        Self::verify_inner(env, policy_id, proof, public_inputs, true)
    }

    pub fn check(
        env: Env,
        policy_id: u32,
        proof: Bytes,
        public_inputs: Bytes,
    ) -> Result<bool, Error> {
        Self::verify_inner(env, policy_id, proof, public_inputs, false)
    }

    pub fn verify_vec(
        env: Env,
        policy_id: u32,
        proof: Bytes,
        public_inputs: Vec<BytesN<32>>,
    ) -> Result<bool, Error> {
        Self::verify(
            env.clone(),
            policy_id,
            proof,
            Self::concat_public_inputs(&env, &public_inputs)?,
        )
    }

    pub fn verify_and_record(
        env: Env,
        holder: Address,
        policy_id: u32,
        proof: Bytes,
        public_inputs: Vec<BytesN<32>>,
    ) -> Result<bool, Error> {
        let ok = Self::verify(
            env.clone(),
            policy_id,
            proof,
            Self::concat_public_inputs(&env, &public_inputs)?,
        )?;
        if ok {
            let nullifier = if public_inputs.len() >= 6 {
                public_inputs.get(5).unwrap()
            } else {
                public_inputs.get(3).unwrap()
            };
            env.storage()
                .persistent()
                .set(&symbol_short!("eligible"), &holder);
            env.storage()
                .instance()
                .set(&symbol_short!("elig"), &holder);
            EligibilityVerified {
                holder,
                policy_id,
                nullifier,
            }
            .publish(&env);
        }
        Ok(ok)
    }

    pub fn is_nullifier_spent(env: Env, policy_id: u32, nullifier: BytesN<32>) -> bool {
        env.storage()
            .persistent()
            .get(&Self::spent_key(policy_id, 1, 1, &nullifier))
            .unwrap_or_else(|| {
                env.storage()
                    .persistent()
                    .get(&Self::spent_key(policy_id, 0, 0, &nullifier))
                    .unwrap_or(false)
            })
    }

    pub fn is_scoped_nullifier_spent(
        env: Env,
        policy_id: u32,
        asset_id: u32,
        action_id: u32,
        nullifier: BytesN<32>,
    ) -> bool {
        env.storage()
            .persistent()
            .get(&Self::spent_key(policy_id, asset_id, action_id, &nullifier))
            .unwrap_or(false)
    }

    pub fn set_eligible(env: Env, holder: Address, eligible: bool) {
        env.storage()
            .persistent()
            .set(&(symbol_short!("flag"), holder.clone()), &eligible);
    }

    pub fn is_eligible(env: Env, holder: Address) -> bool {
        env.storage()
            .persistent()
            .get(&(symbol_short!("flag"), holder))
            .unwrap_or(false)
    }
}

#[contractimpl(contracttrait)]
impl AccessControl for PolicyVerifier {}

#[cfg(test)]
mod test;
