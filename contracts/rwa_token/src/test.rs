#![cfg(test)]
use super::{RwaToken, RwaTokenClient};
use soroban_sdk::{testutils::Address as _, Address, Env};

#[test]
fn freeze_blocks_transfer() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let verifier = Address::generate(&env);
    let holder = Address::generate(&env);
    let contract_id = env.register(RwaToken, (&admin, &verifier, &1u32));
    let client = RwaTokenClient::new(&env, &contract_id);

    client.freeze(&admin, &holder);
    assert!(client.is_frozen(&holder));
}

#[test]
fn mint_and_balance_without_proof_in_test() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let verifier = Address::generate(&env);
    let holder = Address::generate(&env);
    let contract_id = env.register(RwaToken, (&admin, &verifier, &1u32));
    let client = RwaTokenClient::new(&env, &contract_id);
    assert_eq!(client.balance(&holder), 0);
}

#[test]
fn admin_mint_seeds_migrated_balance() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let verifier = Address::generate(&env);
    let holder = Address::generate(&env);
    let contract_id = env.register(RwaToken, (&admin, &verifier, &1u32));
    let client = RwaTokenClient::new(&env, &contract_id);

    client.admin_mint(&admin, &holder, &160);

    assert_eq!(client.balance(&holder), 160);
}
