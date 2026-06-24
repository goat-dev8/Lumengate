#![cfg(test)]
use super::{RwaAdapter, RwaAdapterClient};
use soroban_sdk::{testutils::Address as _, Address, Env};

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
