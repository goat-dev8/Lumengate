#![no_std]
use soroban_sdk::{
    auth::{Context, CustomAccountInterface},
    contract, contractimpl, crypto::Hash, Address, Bytes, Env, IntoVal, Map, String, Symbol, Val,
    Vec,
};
use stellar_accounts::smart_account::{
    self, add_context_rule, AuthPayload, ContextRule, ContextRuleType, ExecutionEntryPoint, Signer,
    SmartAccount, SmartAccountError,
};

/// Kit-compatible per-user Lumengate smart account.
#[contract]
pub struct LumengateSmartAccount;

#[contractimpl]
impl LumengateSmartAccount {
    pub fn __constructor(e: &Env, signers: Vec<Signer>, policies: Map<Address, Val>) {
        add_context_rule(
            e,
            &ContextRuleType::Default,
            &String::from_str(e, "default"),
            None,
            &signers,
            &policies,
        );
    }

    /// Register a secp256r1 passkey signer on the default compliance context rule.
    pub fn add_passkey(e: &Env, admin: Address, verifier: Address, key_data: Bytes) {
        admin.require_auth();
        let signer = Signer::External(verifier, key_data);
        smart_account::batch_add_signer(e, 0, &soroban_sdk::vec![e, signer]);
    }

    /// Bind a fresh eligibility proof to the smart account session before settlement.
    /// Callable by the delegated admin signer configured at deploy time.
    pub fn bind_session_proof(
        e: &Env,
        admin: Address,
        compliance_policy: Address,
        proof: Bytes,
        public_inputs: Bytes,
    ) {
        admin.require_auth();
        let smart_account = e.current_contract_address();
        let mut args = Vec::new(e);
        args.push_back(admin.into_val(e));
        args.push_back(smart_account.into_val(e));
        args.push_back(proof.into_val(e));
        args.push_back(public_inputs.into_val(e));
        e.invoke_contract::<()>(
            &compliance_policy,
            &Symbol::new(e, "operator_bind_session_proof"),
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
