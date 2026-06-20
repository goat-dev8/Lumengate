#![no_std]
use soroban_sdk::{contract, contracterror, contractimpl, contracttrait, Address, Bytes, Env, IntoVal, Symbol, Vec};
use stellar_access::access_control::{grant_role_no_auth, set_admin, AccessControl};
use stellar_macros::only_role;

/// SEP-57-style identity verifier adapter for Lumengate compliance passports.
#[contract]
pub struct RwaAdapter;

#[contracterror]
#[repr(u32)]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum Error {
    NotAdmin = 1,
    VerifierNotSet = 2,
    VerificationFailed = 3,
}

#[contractimpl]
impl RwaAdapter {
    pub fn __constructor(env: Env, admin: Address, verifier: Address) {
        set_admin(&env, &admin);
        grant_role_no_auth(
            &env,
            &admin,
            &Symbol::new(&env, "adapter_admin"),
            &admin,
        );
        env.storage()
            .instance()
            .set(&Symbol::new(&env, "verifier"), &verifier);
    }

    fn verifier(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&Symbol::new(env, "verifier"))
            .expect("verifier not set")
    }

    #[only_role(caller, "adapter_admin")]
    pub fn set_verifier(env: Env, caller: Address, verifier: Address) -> Result<(), Error> {
        env.storage()
            .instance()
            .set(&Symbol::new(&env, "verifier"), &verifier);
        Ok(())
    }

    pub fn verifier_address(env: Env) -> Address {
        Self::verifier(&env)
    }

    pub fn verify_passport(
        env: Env,
        policy_id: u32,
        proof: Bytes,
        public_inputs: Bytes,
    ) -> Result<bool, Error> {
        let verifier = Self::verifier(&env);
        let mut args = Vec::new(&env);
        args.push_back(policy_id.into_val(&env));
        args.push_back(proof.into_val(&env));
        args.push_back(public_inputs.into_val(&env));
        let ok: bool = env.invoke_contract(
            &verifier,
            &Symbol::new(&env, "verify"),
            args,
        );
        if !ok {
            return Err(Error::VerificationFailed);
        }
        Ok(true)
    }

    pub fn is_eligible(
        env: Env,
        policy_id: u32,
        proof: Bytes,
        public_inputs: Bytes,
    ) -> bool {
        Self::verify_passport(env, policy_id, proof, public_inputs).unwrap_or(false)
    }
}

#[contractimpl(contracttrait)]
impl AccessControl for RwaAdapter {}

#[cfg(test)]
mod test;
