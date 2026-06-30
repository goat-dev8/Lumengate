#![no_std]
use soroban_sdk::{auth::Context, contract, contracterror, contractimpl, contracttype, Address, Bytes, Env, IntoVal, Symbol, Vec};
use stellar_accounts::{
    policies::Policy,
    smart_account::{ContextRule, Signer},
};

/// OZ Policy: gates smart-account auth by reading session proof from SessionStore
/// and calling RwaAdapter check_passport.
#[contract]
pub struct CompliancePolicy;

#[contracterror]
#[repr(u32)]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum Error {
    NotConfigured = 1,
    VerificationFailed = 2,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CompliancePolicyParams {
    pub adapter: Address,
    pub policy_id: u32,
    pub session_store: Address,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SessionProof {
    pub proof: Bytes,
    pub public_inputs: Bytes,
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
            .remove(&(Symbol::new(e, "cfg"), smart_account));
    }

    fn enforce(
        e: &Env,
        context: Context,
        _authenticated_signers: Vec<Signer>,
        _context_rule: ContextRule,
        smart_account: Address,
    ) {
        let cfg: CompliancePolicyParams = e
            .storage()
            .persistent()
            .get(&(Symbol::new(e, "cfg"), smart_account.clone()))
            .unwrap_or_else(|| e.panic_with_error(Error::NotConfigured));

        if Self::is_session_bind_context(e, &context, &cfg.session_store) {
            return;
        }

        let mut args = Vec::new(e);
        args.push_back(smart_account.into_val(e));
        let session: SessionProof = e.invoke_contract(
            &cfg.session_store,
            &Symbol::new(e, "get_proof"),
            args,
        );

        let mut verify_args = Vec::new(e);
        verify_args.push_back(cfg.policy_id.into_val(e));
        verify_args.push_back(session.proof.into_val(e));
        verify_args.push_back(session.public_inputs.into_val(e));
        let ok: bool = e.invoke_contract(
            &cfg.adapter,
            &Symbol::new(e, "check_passport"),
            verify_args,
        );
        if !ok {
            e.panic_with_error(Error::VerificationFailed);
        }
    }
}

#[contractimpl]
impl CompliancePolicy {
    fn is_session_bind_context(
        _env: &Env,
        context: &Context,
        session_store: &Address,
    ) -> bool {
        match context {
            Context::Contract(call) => {
                call.contract == *session_store
                    && call.fn_name == Symbol::new(_env, "set_proof")
            }
            _ => false,
        }
    }
}

#[cfg(test)]
mod test;
