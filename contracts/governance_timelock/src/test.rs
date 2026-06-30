#![cfg(test)]
use super::{TimelockController, TimelockControllerClient};
use soroban_sdk::{testutils::Address as _, Address, Env};

#[test]
fn timelock_constructs_with_external_admin() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let proposers = soroban_sdk::Vec::<Address>::new(&env);
    let executors = soroban_sdk::Vec::<Address>::new(&env);
    let contract_id = env.register(
        TimelockController,
        (&17_280u32, &proposers, &executors, &Some(admin.clone())),
    );
    let _client = TimelockControllerClient::new(&env, &contract_id);
}
