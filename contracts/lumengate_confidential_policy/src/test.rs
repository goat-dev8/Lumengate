#![cfg(test)]
use super::{LumengateConfidentialPolicy, LumengateConfidentialPolicyClient};
use soroban_sdk::{testutils::Address as _, Address, Env};

#[test]
fn is_authorized_false_without_bound_session_proof() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let session_store = Address::generate(&env);
    let policy_verifier = Address::generate(&env);
    let token = Address::generate(&env);
    let account = Address::generate(&env);

    let policy_id = env.register(
        LumengateConfidentialPolicy,
        (&admin, &session_store, &policy_verifier, &1u32),
    );
    let client = LumengateConfidentialPolicyClient::new(&env, &policy_id);

    assert!(!client.is_authorized(&account, &token));
}

#[test]
fn is_authorized_false_for_unknown_token() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let session_store = Address::generate(&env);
    let policy_verifier = Address::generate(&env);
    let account = Address::generate(&env);
    let other_token = Address::generate(&env);

    let policy_id = env.register(
        LumengateConfidentialPolicy,
        (&admin, &session_store, &policy_verifier, &1u32),
    );
    let client = LumengateConfidentialPolicyClient::new(&env, &policy_id);

    assert!(!client.is_authorized(&account, &other_token));
}
