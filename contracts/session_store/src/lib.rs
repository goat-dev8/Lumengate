#![no_std]
use soroban_sdk::{contract, contracterror, contractimpl, contracttype, Address, Bytes, Env, Symbol};

/// Stores per-smart-account eligibility session proofs.
///
/// Kept separate from the installed compliance policy so passkey authorization of
/// `set_proof` does not re-enter the policy contract during `__check_auth`.
#[contract]
pub struct SessionStore;

#[contracterror]
#[repr(u32)]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum Error {
    NotConfigured = 1,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SessionProof {
    pub proof: Bytes,
    pub public_inputs: Bytes,
}

#[contractimpl]
impl SessionStore {
    /// Bind a fresh eligibility proof before settlement. Requires smart-account passkey auth.
    pub fn set_proof(env: Env, smart_account: Address, proof: Bytes, public_inputs: Bytes) {
        smart_account.require_auth();
        env.storage().persistent().set(
            &(Symbol::new(&env, "proof"), smart_account),
            &SessionProof {
                proof,
                public_inputs,
            },
        );
    }

    /// Operator path for delegated admin binding without nested smart-account auth entries.
    pub fn operator_set_proof(
        env: Env,
        operator: Address,
        smart_account: Address,
        proof: Bytes,
        public_inputs: Bytes,
    ) {
        operator.require_auth();
        env.storage().persistent().set(
            &(Symbol::new(&env, "proof"), smart_account),
            &SessionProof {
                proof,
                public_inputs,
            },
        );
    }

    /// Read the bound session proof for a smart account (used by compliance policy).
    pub fn get_proof(env: Env, smart_account: Address) -> SessionProof {
        env.storage()
            .persistent()
            .get(&(Symbol::new(&env, "proof"), smart_account))
            .unwrap_or_else(|| env.panic_with_error(Error::NotConfigured))
    }

    /// Non-panicking read for CT policy hook and off-chain checks.
    pub fn get_bound_proof(env: Env, smart_account: Address) -> Option<SessionProof> {
        env.storage()
            .persistent()
            .get(&(Symbol::new(&env, "proof"), smart_account))
    }
}
