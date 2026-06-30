#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, Address, Bytes, Env, IntoVal, Symbol, Vec,
    InvokeError,
};
use stellar_access::access_control::{self as access_control, AccessControl};
use stellar_tokens::confidential::compliance::Policy;

#[contract]
pub struct LumengateConfidentialPolicy;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SessionProof {
    pub proof: Bytes,
    pub public_inputs: Bytes,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PolicyConfig {
    pub session_store: Address,
    pub policy_verifier: Address,
    pub policy_id: u32,
}

#[contractimpl]
impl LumengateConfidentialPolicy {
    pub fn __constructor(
        e: &Env,
        admin: Address,
        session_store: Address,
        policy_verifier: Address,
        policy_id: u32,
    ) {
        access_control::set_admin(e, &admin);
        e.storage().instance().set(
            &Symbol::new(e, "cfg"),
            &PolicyConfig {
                session_store,
                policy_verifier,
                policy_id,
            },
        );
    }

    fn config(e: &Env) -> PolicyConfig {
        e.storage()
            .instance()
            .get(&Symbol::new(e, "cfg"))
            .expect("policy not configured")
    }
}

#[contractimpl]
impl Policy for LumengateConfidentialPolicy {
    fn is_authorized(e: Env, account: Address, _token: Address) -> bool {
        let cfg = LumengateConfidentialPolicy::config(&e);
        let mut proof_args = Vec::new(&e);
        proof_args.push_back(account.clone().into_val(&e));
        let session = match e.try_invoke_contract::<SessionProof, InvokeError>(
            &cfg.session_store,
            &Symbol::new(&e, "get_proof"),
            proof_args,
        ) {
            Ok(Ok(proof)) => proof,
            _ => return false,
        };

        let mut verify_args = Vec::new(&e);
        verify_args.push_back(cfg.policy_id.into_val(&e));
        verify_args.push_back(session.proof.into_val(&e));
        verify_args.push_back(session.public_inputs.into_val(&e));
        e.invoke_contract::<bool>(
            &cfg.policy_verifier,
            &Symbol::new(&e, "validate"),
            verify_args,
        )
    }
}

#[contractimpl(contracttrait)]
impl AccessControl for LumengateConfidentialPolicy {}

#[cfg(test)]
mod test;
