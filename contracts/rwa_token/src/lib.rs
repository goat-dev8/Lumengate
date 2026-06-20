#![no_std]
use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttrait, symbol_short, Address, Bytes, Env,
    IntoVal, Symbol, Vec,
};
use stellar_access::access_control::{grant_role_no_auth, set_admin, AccessControl};
use stellar_macros::only_role;

#[contract]
pub struct RwaToken;

#[contracterror]
#[repr(u32)]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum Error {
    NotAdmin = 1,
    Frozen = 2,
    InsufficientBalance = 3,
    VerificationFailed = 4,
    InvalidProof = 5,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TransferGated {
    pub from: Address,
    pub to: Address,
    pub amount: i128,
    pub policy_id: u32,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct HolderFrozen {
    pub holder: Address,
}

#[contractimpl]
impl RwaToken {
    pub fn __constructor(env: Env, admin: Address, verifier: Address, policy_id: u32) {
        set_admin(&env, &admin);
        grant_role_no_auth(
            &env,
            &admin,
            &Symbol::new(&env, "token_admin"),
            &admin,
        );
        env.storage().instance().set(&Symbol::new(&env, "verifier"), &verifier);
        env.storage().instance().set(&Symbol::new(&env, "policy"), &policy_id);
    }

    fn verifier(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&Symbol::new(env, "verifier"))
            .expect("verifier not set")
    }

    fn _stored_policy_id(env: &Env) -> u32 {
        env.storage()
            .instance()
            .get(&Symbol::new(env, "policy"))
            .unwrap_or(1u32)
    }

    fn balance_key(holder: &Address) -> (Symbol, Address) {
        (symbol_short!("bal"), holder.clone())
    }

    fn frozen_key(holder: &Address) -> (Symbol, Address) {
        (symbol_short!("frzn"), holder.clone())
    }

    #[only_role(caller, "token_admin")]
    pub fn freeze(env: Env, caller: Address, holder: Address) -> Result<(), Error> {
        env.storage()
            .persistent()
            .set(&Self::frozen_key(&holder), &true);
        HolderFrozen { holder: holder.clone() }.publish(&env);
        Ok(())
    }

    pub fn is_frozen(env: Env, holder: Address) -> bool {
        env.storage()
            .persistent()
            .get(&Self::frozen_key(&holder))
            .unwrap_or(false)
    }

    fn require_not_frozen(env: &Env, holder: &Address) -> Result<(), Error> {
        if Self::is_frozen(env.clone(), holder.clone()) {
            return Err(Error::Frozen);
        }
        Ok(())
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

    fn policy_id_from_public_inputs(public_inputs: &Bytes) -> Result<u32, Error> {
        if public_inputs.len() < 96 {
            return Err(Error::InvalidProof);
        }
        let slice = public_inputs.slice(64..96);
        let mut arr = [0u8; 32];
        slice.copy_into_slice(&mut arr);
        let id = Self::field_bytes_to_u32(&arr);
        if id == 0 {
            return Err(Error::InvalidProof);
        }
        Ok(id)
    }

    fn verify_eligibility(
        env: &Env,
        _holder: &Address,
        proof: &Bytes,
        public_inputs: &Bytes,
    ) -> Result<u32, Error> {
        let verifier = Self::verifier(env);
        let policy_id = Self::policy_id_from_public_inputs(public_inputs)?;
        let mut args = Vec::new(env);
        args.push_back(policy_id.into_val(env));
        args.push_back(proof.into_val(env));
        args.push_back(public_inputs.into_val(env));
        let result: bool = env.invoke_contract(
            &verifier,
            &Symbol::new(env, "verify"),
            args,
        );
        if !result {
            return Err(Error::VerificationFailed);
        }
        Ok(policy_id)
    }

    pub fn mint(
        env: Env,
        to: Address,
        amount: i128,
        proof: Bytes,
        public_inputs: Bytes,
    ) -> Result<(), Error> {
        Self::require_not_frozen(&env, &to)?;
        let _policy_id = Self::verify_eligibility(&env, &to, &proof, &public_inputs)?;
        let key = Self::balance_key(&to);
        let bal: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        env.storage().persistent().set(&key, &(bal + amount));
        Ok(())
    }

    pub fn transfer(
        env: Env,
        from: Address,
        to: Address,
        amount: i128,
        proof: Bytes,
        public_inputs: Bytes,
    ) -> Result<(), Error> {
        from.require_auth();
        Self::require_not_frozen(&env, &from)?;
        Self::require_not_frozen(&env, &to)?;
        let policy_id = Self::verify_eligibility(&env, &from, &proof, &public_inputs)?;

        let from_key = Self::balance_key(&from);
        let to_key = Self::balance_key(&to);
        let from_bal: i128 = env.storage().persistent().get(&from_key).unwrap_or(0);
        if from_bal < amount {
            return Err(Error::InsufficientBalance);
        }
        let to_bal: i128 = env.storage().persistent().get(&to_key).unwrap_or(0);
        env.storage()
            .persistent()
            .set(&from_key, &(from_bal - amount));
        env.storage().persistent().set(&to_key, &(to_bal + amount));

        TransferGated {
            from: from.clone(),
            to: to.clone(),
            amount,
            policy_id,
        }
        .publish(&env);
        Ok(())
    }

    pub fn balance(env: Env, holder: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&Self::balance_key(&holder))
            .unwrap_or(0)
    }

    #[only_role(caller, "token_admin")]
    pub fn set_verifier(env: Env, caller: Address, verifier: Address) -> Result<(), Error> {
        env.storage()
            .instance()
            .set(&Symbol::new(&env, "verifier"), &verifier);
        Ok(())
    }
}

#[contractimpl(contracttrait)]
impl AccessControl for RwaToken {}

#[cfg(test)]
mod test;
