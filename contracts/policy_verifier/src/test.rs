#![cfg(test)]
use super::{PolicyVerifier, PolicyVerifierClient};
use soroban_sdk::{testutils::Address as _, Address, BytesN, Env};

#[test]
fn policy_verifier_constructs() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let _id = env.register(PolicyVerifier, (&admin,));
}

#[test]
fn scoped_nullifier_not_spent_initially() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let contract_id = env.register(PolicyVerifier, (&admin,));
    let client = PolicyVerifierClient::new(&env, &contract_id);

    let nullifier = BytesN::from_array(&env, &[11u8; 32]);
    assert!(!client.is_scoped_nullifier_spent(&1u32, &2u32, &1u32, &nullifier));
    assert!(!client.is_nullifier_spent(&1u32, &nullifier));
}

#[test]
fn set_eligible_flag_roundtrip() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let holder = Address::generate(&env);
    let contract_id = env.register(PolicyVerifier, (&admin,));
    let client = PolicyVerifierClient::new(&env, &contract_id);

    assert!(!client.is_eligible(&holder));
    client.set_eligible(&holder, &true);
    assert!(client.is_eligible(&holder));
    client.set_eligible(&holder, &false);
    assert!(!client.is_eligible(&holder));
}

#[test]
#[should_panic(expected = "Error(Contract, #2)")]
fn get_verifier_unknown_policy_panics() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let contract_id = env.register(PolicyVerifier, (&admin,));
    let client = PolicyVerifierClient::new(&env, &contract_id);
    let _ = client.get_verifier(&99u32);
}

#[test]
fn scoped_nullifier_keys_are_independent() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let contract_id = env.register(PolicyVerifier, (&admin,));
    let client = PolicyVerifierClient::new(&env, &contract_id);
    let nullifier = BytesN::from_array(&env, &[42u8; 32]);

    assert!(!client.is_scoped_nullifier_spent(&1u32, &2u32, &1u32, &nullifier));
    assert!(!client.is_scoped_nullifier_spent(&1u32, &3u32, &1u32, &nullifier));
}
