#![no_std]
use soroban_sdk::{
    auth::{Context, CustomAccountInterface},
    contract, contractimpl, crypto::Hash, panic_with_error, Address, Bytes, Env, IntoVal, Map,
    String, Symbol, Val, Vec, xdr::ToXdr,
};
use stellar_accounts::policies::PolicyClient;
use stellar_accounts::smart_account::{
    self, add_context_rule, authenticate, get_context_rule, get_validated_context_by_id,
    AuthPayload, ContextRule, ContextRuleType, ExecutionEntryPoint, Signer, SmartAccount,
    SmartAccountError, SmartAccountStorageKey,
};

/// Passkey bind calls `compliance_policy.set_session_proof`, which requires smart-account auth.
/// `do_check_auth` would re-enter the same policy contract via `PolicyClient.enforce` (Soroban
/// forbids re-entry). Skip enforce for that bind context; passkey auth is sufficient.
fn is_session_proof_bind_context(env: &Env, context: &Context, policy: &Address) -> bool {
    match context {
        Context::Contract(call) => {
            call.contract == *policy && call.fn_name == Symbol::new(env, "set_session_proof")
        }
        _ => false,
    }
}

fn lumengate_do_check_auth(
    e: &Env,
    signature_payload: &Hash<32>,
    signatures: &AuthPayload,
    auth_contexts: &Vec<Context>,
) -> Result<(), SmartAccountError> {
    if signatures.context_rule_ids.len() != auth_contexts.len() {
        panic_with_error!(e, SmartAccountError::ContextRuleIdsLengthMismatch);
    }

    let validated_contexts = Vec::from_iter(
        e,
        auth_contexts.iter().enumerate().map(|(i, context)| {
            let all_signers = signatures.signers.keys();
            let context_rule_id = signatures.context_rule_ids.get_unchecked(i as u32);
            get_validated_context_by_id(e, &context, &all_signers, context_rule_id)
        }),
    );

    let mut allowed_signers = Map::new(e);
    for (rule, _, _) in validated_contexts.iter() {
        for signer in rule.signers.iter() {
            allowed_signers.set(signer, ());
        }
    }

    let mut preimage = signature_payload.to_bytes().to_bytes();
    preimage.append(&signatures.context_rule_ids.clone().to_xdr(e));
    let auth_digest = e.crypto().sha256(&preimage);

    for (signer, sig_data) in signatures.signers.iter() {
        if !allowed_signers.contains_key(signer.clone()) {
            panic_with_error!(e, SmartAccountError::UnauthorizedSigner);
        }
        authenticate(e, &auth_digest, &signer, &sig_data);
    }

    for (rule, context, matched_signers) in validated_contexts.iter() {
        for policy in rule.policies.iter() {
            if is_session_proof_bind_context(e, &context, &policy) {
                continue;
            }
            PolicyClient::new(e, &policy).enforce(
                &context,
                &matched_signers,
                &rule,
                &e.current_contract_address(),
            );
        }
    }

    Ok(())
}

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
        lumengate_do_check_auth(&e, &signature_payload, &signatures, &auth_contexts)
    }
}

#[contractimpl(contracttrait)]
impl SmartAccount for LumengateSmartAccount {}

#[contractimpl(contracttrait)]
impl ExecutionEntryPoint for LumengateSmartAccount {}
