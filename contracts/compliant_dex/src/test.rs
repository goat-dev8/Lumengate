#![cfg(test)]
use super::{CompliantDex, CompliantDexClient};
use soroban_sdk::{testutils::Address as _, Address, Env};

#[test]
fn dex_constructs_with_adapter_and_sac() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let adapter = Address::generate(&env);
    let sac = Address::generate(&env);
    let contract_id = env.register(CompliantDex, (&admin, &adapter, &sac, &1u32));
    let _client = CompliantDexClient::new(&env, &contract_id);
}
