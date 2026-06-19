#![no_std]
use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttrait, symbol_short, Address, Bytes,
    BytesN, Env, InvokeError, IntoVal, Map, Symbol, Vec,
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
        grant_role_no_auth(
            &env,
            &admin,
            &Symbol::new(&env, "policy_admin"),
            &admin,
        );
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

    fn spent_key(policy_id: u32, nullifier: &BytesN<32>) -> (u32, BytesN<32>) {
        (policy_id, nullifier.clone())
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

    pub fn verify(
        env: Env,
        policy_id: u32,
        proof: Bytes,
        public_inputs: Bytes,
    ) -> Result<bool, Error> {
        if proof.len() as usize != PROOF_BYTES {
            return Err(Error::ProofParseError);
        }
        if public_inputs.len() as usize % 32 != 0 || public_inputs.len() == 0 {
            return Err(Error::InvalidPublicInputs);
        }
        let verifiers = Self::policy_verifiers(&env);
        let verifier = verifiers.get(policy_id).ok_or(Error::PolicyNotFound)?;

        // Nullifier is public input index 3 (root, rev_root, policy_id, nullifier) — V3: no wallet
        if public_inputs.len() < 128 {
            return Err(Error::InvalidPublicInputs);
        }
        let nullifier_bytes = public_inputs.slice(96..128);
        let mut nullifier_arr = [0u8; 32];
        nullifier_bytes.copy_into_slice(&mut nullifier_arr);
        let nullifier = BytesN::from_array(&env, &nullifier_arr);
        if env
            .storage()
            .persistent()
            .get(&Self::spent_key(policy_id, &nullifier))
            .unwrap_or(false)
        {
            return Err(Error::NullifierSpent);
        }

        match env.try_invoke_contract::<(), InvokeError>(
            &verifier,
            &Symbol::new(&env, "verify_proof"),
            soroban_sdk::vec![
                &env,
                public_inputs.into_val(&env),
                proof.into_val(&env),
            ],
        ) {
            Ok(Ok(())) => {}
            _ => return Err(Error::VerificationFailed),
        }

        env.storage()
            .persistent()
            .set(&Self::spent_key(policy_id, &nullifier), &true);

        Ok(true)
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
            let nullifier = public_inputs.get(3).unwrap();
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
            .get(&Self::spent_key(policy_id, &nullifier))
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
