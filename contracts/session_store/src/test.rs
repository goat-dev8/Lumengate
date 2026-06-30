#![cfg(test)]
use super::{SessionStore, SessionStoreClient};
use soroban_sdk::{testutils::Address as _, Address, Bytes, Env};

#[test]
fn operator_set_and_get_proof() {
    let env = Env::default();
    env.mock_all_auths();
    let operator = Address::generate(&env);
    let smart_account = Address::generate(&env);
    let contract_id = env.register(SessionStore, ());
    let client = SessionStoreClient::new(&env, &contract_id);

    let proof = Bytes::from_array(&env, &[1u8; 8]);
    let public_inputs = Bytes::from_array(&env, &[2u8; 8]);
    client.operator_set_proof(&operator, &smart_account, &proof, &public_inputs);

    let bound = client.get_proof(&smart_account);
    assert_eq!(bound.proof, proof);
    assert_eq!(bound.public_inputs, public_inputs);
}

#[test]
fn get_bound_proof_empty_returns_none() {
    let env = Env::default();
    let smart_account = Address::generate(&env);
    let contract_id = env.register(SessionStore, ());
    let client = SessionStoreClient::new(&env, &contract_id);

    assert!(client.get_bound_proof(&smart_account).is_none());
}

#[test]
fn set_proof_requires_smart_account_auth() {
    let env = Env::default();
    env.mock_all_auths();
    let smart_account = Address::generate(&env);
    let contract_id = env.register(SessionStore, ());
    let client = SessionStoreClient::new(&env, &contract_id);

    let proof = Bytes::from_array(&env, &[9u8; 4]);
    let public_inputs = Bytes::from_array(&env, &[8u8; 4]);
    client.set_proof(&smart_account, &proof, &public_inputs);
    assert!(client.get_bound_proof(&smart_account).is_some());
}

#[test]
fn operator_set_overwrites_prior_proof() {
    let env = Env::default();
    env.mock_all_auths();
    let operator = Address::generate(&env);
    let smart_account = Address::generate(&env);
    let contract_id = env.register(SessionStore, ());
    let client = SessionStoreClient::new(&env, &contract_id);

    let proof_a = Bytes::from_array(&env, &[1u8; 4]);
    let inputs_a = Bytes::from_array(&env, &[2u8; 4]);
    client.operator_set_proof(&operator, &smart_account, &proof_a, &inputs_a);

    let proof_b = Bytes::from_array(&env, &[3u8; 4]);
    let inputs_b = Bytes::from_array(&env, &[4u8; 4]);
    client.operator_set_proof(&operator, &smart_account, &proof_b, &inputs_b);

    let bound = client.get_proof(&smart_account);
    assert_eq!(bound.proof, proof_b);
    assert_eq!(bound.public_inputs, inputs_b);
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")]
fn get_proof_panics_when_unconfigured() {
    let env = Env::default();
    let smart_account = Address::generate(&env);
    let contract_id = env.register(SessionStore, ());
    let client = SessionStoreClient::new(&env, &contract_id);
    let _ = client.get_proof(&smart_account);
}
