#![no_std]
use soroban_sdk::{auth::{Context, CustomAccountInterface}, contract, contractimpl, contracttype, crypto::Hash, Address, Bytes, Env, IntoVal, Map, String, Symbol, Val, Vec};
use stellar_accounts::smart_account::{
    self, add_context_rule, AuthPayload, ContextRule, ContextRuleType, ExecutionEntryPoint, Signer,
    SmartAccount, SmartAccountError,
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
struct PolicyInstallParams {
    adapter: Address,
    policy_id: u32,
}

/// Lumengate smart account with CompliancePolicy in the default context rule.
#[contract]
pub struct LumengateSmartAccount;

#[contractimpl]
impl LumengateSmartAccount {
    pub fn __constructor(
        e: &Env,
        admin: Address,
        compliance_policy: Address,
        adapter: Address,
        policy_id: u32,
    ) {
        let mut signers = Vec::new(e);
        signers.push_back(Signer::Delegated(admin));
        let mut policies = Map::new(e);
        policies.set(
            compliance_policy,
            PolicyInstallParams { adapter, policy_id }.into_val(e),
        );
        add_context_rule(
            e,
            &ContextRuleType::Default,
            &String::from_str(e, "compliance"),
            None,
            &signers,
            &policies,
        );
    }

    /// Store session proof on the compliance policy before authorizing SAC transfers.
    pub fn bind_session_proof(
        e: &Env,
        smart_account: Address,
        compliance_policy: Address,
        proof: Bytes,
        public_inputs: Bytes,
    ) {
        smart_account.require_auth();
        let mut args = Vec::new(e);
        args.push_back(smart_account.into_val(e));
        args.push_back(proof.into_val(e));
        args.push_back(public_inputs.into_val(e));
        e.invoke_contract::<()>(
            &compliance_policy,
            &Symbol::new(e, "set_session_proof"),
            args,
        );
    }
}

#[contractimpl]
impl CustomAccountInterface for LumengateSmartAccount {
    type Error = SmartAccountError;
    type Signature = AuthPayload;

    fn __check_auth(
        e: Env,
        signature_payload: Hash<32>,
        signatures: AuthPayload,
        auth_contexts: Vec<Context>,
    ) -> Result<(), Self::Error> {
        smart_account::do_check_auth(&e, &signature_payload, &signatures, &auth_contexts)
    }
}

#[contractimpl(contracttrait)]
impl SmartAccount for LumengateSmartAccount {}

#[contractimpl(contracttrait)]
impl ExecutionEntryPoint for LumengateSmartAccount {}
