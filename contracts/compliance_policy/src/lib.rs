#![no_std]
use soroban_sdk::{auth::Context, contract, contracterror, contractimpl, Address, Bytes, Env, IntoVal, Symbol, Vec};
use stellar_accounts::{
    policies::Policy,
    smart_account::{ContextRule, Signer},
};

/// OZ Policy: gates smart-account auth by calling RwaAdapter verify_passport with session proof.
#[contract]
pub struct CompliancePolicy;

#[contracterror]
#[repr(u32)]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum Error {
    NotConfigured = 1,
    VerificationFailed = 2,
}

#[contractimpl]
impl Policy for CompliancePolicy {
    type AccountParams = CompliancePolicyParams;

    fn install(
        e: &Env,
        install_params: Self::AccountParams,
        _context_rule: ContextRule,
        smart_account: Address,
    ) {
        e.storage().persistent().set(
            &(Symbol::new(e, "cfg"), smart_account.clone()),
            &install_params,
        );
    }

    fn uninstall(e: &Env, _context_rule: ContextRule, smart_account: Address) {
        e.storage()
            .persistent()
            .remove(&(Symbol::new(e, "cfg"), smart_account.clone()));
        e.storage()
            .persistent()
            .remove(&(Symbol::new(e, "proof"), smart_account));
    }

    fn enforce(
        e: &Env,
        _context: Context,
        _authenticated_signers: Vec<Signer>,
        _context_rule: ContextRule,
        smart_account: Address,
    ) {
        let cfg: CompliancePolicyParams = e
            .storage()
            .persistent()
            .get(&(Symbol::new(e, "cfg"), smart_account.clone()))
            .unwrap_or_else(|| e.panic_with_error(Error::NotConfigured));
        let session: SessionProof = e
            .storage()
            .persistent()
            .get(&(Symbol::new(e, "proof"), smart_account))
            .unwrap_or_else(|| e.panic_with_error(Error::NotConfigured));

        let mut args = Vec::new(e);
        args.push_back(cfg.policy_id.into_val(e));
        args.push_back(session.proof.into_val(e));
        args.push_back(session.public_inputs.into_val(e));
        let ok: bool = e.invoke_contract(
            &cfg.adapter,
            &Symbol::new(e, "verify_passport"),
            args,
        );
        if !ok {
            e.panic_with_error(Error::VerificationFailed);
        }
    }
}

#[contractimpl]
impl CompliancePolicy {
    /// Bind a fresh eligibility proof to the smart account session before settlement.
    pub fn set_session_proof(
        env: Env,
        smart_account: Address,
        proof: Bytes,
        public_inputs: Bytes,
    ) {
        smart_account.require_auth();
        env.storage().persistent().set(
            &(Symbol::new(&env, "proof"), smart_account),
            &SessionProof {
                proof,
                public_inputs,
            },
        );
    }
}

use soroban_sdk::contracttype;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CompliancePolicyParams {
    pub adapter: Address,
    pub policy_id: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SessionProof {
    pub proof: Bytes,
    pub public_inputs: Bytes,
}
