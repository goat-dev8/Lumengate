#![no_std]
use soroban_sdk::{contract, contracterror, contractimpl, Address, Bytes, Env, IntoVal, Symbol, Vec};
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
        Self::verify_with_mode(env, policy_id, proof, public_inputs, true)
    }

    pub fn check_passport(
        env: Env,
        policy_id: u32,
        proof: Bytes,
        public_inputs: Bytes,
    ) -> Result<bool, Error> {
        Self::verify_with_mode(env, policy_id, proof, public_inputs, false)
    }

    /// Compatibility entrypoint for RwaToken, which invokes `verify` on its verifier address.
    pub fn verify(
        env: Env,
        policy_id: u32,
        proof: Bytes,
        public_inputs: Bytes,
    ) -> Result<bool, Error> {
        Self::verify_with_mode(env, policy_id, proof, public_inputs, true)
    }

    fn verify_with_mode(
        env: Env,
        policy_id: u32,
        proof: Bytes,
        public_inputs: Bytes,
        spend_nullifier: bool,
    ) -> Result<bool, Error> {
        let verifier = Self::verifier(&env);
        let mut args = Vec::new(&env);
        args.push_back(policy_id.into_val(&env));
        args.push_back(proof.into_val(&env));
        args.push_back(public_inputs.into_val(&env));
        let function = if spend_nullifier { "verify" } else { "check" };
        let ok: bool = env.invoke_contract(
            &verifier,
            &Symbol::new(&env, function),
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
        Self::check_passport(env, policy_id, proof, public_inputs).unwrap_or(false)
    }

    /// Passport validity for confidential-token authorization (ignores spent nullifiers).
    pub fn validate_passport(
        env: Env,
        policy_id: u32,
        proof: Bytes,
        public_inputs: Bytes,
    ) -> bool {
        let verifier = Self::verifier(&env);
        let mut args = Vec::new(&env);
        args.push_back(policy_id.into_val(&env));
        args.push_back(proof.into_val(&env));
        args.push_back(public_inputs.into_val(&env));
        match env.try_invoke_contract::<bool, soroban_sdk::InvokeError>(
            &verifier,
            &Symbol::new(&env, "validate"),
            args,
        ) {
            Ok(Ok(true)) => true,
            _ => false,
        }
    }
}

#[contractimpl(contracttrait)]
impl AccessControl for RwaAdapter {}

#[cfg(test)]
mod test;
