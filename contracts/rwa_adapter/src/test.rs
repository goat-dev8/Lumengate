#![cfg(test)]
use super::{RwaAdapter, RwaAdapterClient};
use soroban_sdk::{testutils::Address as _, Address, Bytes, Env};

#[test]
fn adapter_constructs_and_returns_verifier() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let verifier = Address::generate(&env);
    let contract_id = env.register(RwaAdapter, (&admin, &verifier));
    let client = RwaAdapterClient::new(&env, &contract_id);

    assert_eq!(client.verifier_address(), verifier);
}

#[test]
fn validate_passport_false_without_verifier_setup() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let verifier = Address::generate(&env);
    let contract_id = env.register(RwaAdapter, (&admin, &verifier));
    let client = RwaAdapterClient::new(&env, &contract_id);

    let proof = Bytes::from_array(&env, &[0u8; 16]);
    let public_inputs = Bytes::from_array(&env, &[0u8; 32]);
    assert!(!client.validate_passport(&1u32, &proof, &public_inputs));
}
