#![no_std]
use soroban_sdk::{
    auth::{Context, CustomAccountInterface},
    contract, contractimpl, crypto::Hash, Address, Bytes, Env, IntoVal, Map, String, Symbol, Val,
    Vec,
};
use stellar_accounts::smart_account::{
    self, add_context_rule, do_check_auth, get_context_rule, AuthPayload, ContextRule,
    ContextRuleType, ExecutionEntryPoint, Signer, SmartAccount, SmartAccountError,
    SmartAccountStorageKey,
};

/// Kit-compatible per-user Lumengate smart account (OpenZeppelin / stellar-accounts pattern).
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

    /// Kit compatibility: `smart-account-kit` still calls the removed bulk getter.
    pub fn get_context_rules(e: &Env, context_rule_type: ContextRuleType) -> Vec<ContextRule> {
        let next_id: u32 = e
            .storage()
            .instance()
            .get(&SmartAccountStorageKey::NextId)
            .unwrap_or(0);
        let mut rules = Vec::new(e);
        for id in 0..next_id {
            if e.storage()
                .persistent()
                .has(&SmartAccountStorageKey::ContextRuleData(id))
            {
                let rule = get_context_rule(e, id);
                if rule.context_type == context_rule_type {
                    rules.push_back(rule);
                }
            }
        }
        rules
    }

    /// Operator bind via SessionStore (admin signer, not passkey).
    pub fn bind_session_proof(
        e: &Env,
        admin: Address,
        session_store: Address,
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
            &session_store,
            &Symbol::new(e, "operator_set_proof"),
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
        do_check_auth(&e, &signature_payload, &signatures, &auth_contexts)
    }
}

#[contractimpl(contracttrait)]
impl SmartAccount for LumengateSmartAccount {}

#[contractimpl(contracttrait)]
impl ExecutionEntryPoint for LumengateSmartAccount {}
