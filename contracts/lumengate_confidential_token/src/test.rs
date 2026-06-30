#![cfg(test)]
use super::{LumengateConfidentialToken, LumengateConfidentialTokenClient};
use soroban_sdk::{testutils::Address as _, Address, Env};

#[test]
fn confidential_token_constructs_with_compliance_config() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let underlying = Address::generate(&env);
    let verifier = Address::generate(&env);
    let auditor = Address::generate(&env);
    let policy = Address::generate(&env);
    let contract_id = env.register(
        LumengateConfidentialToken,
        (&admin, &underlying, &verifier, &auditor, &policy),
    );
    let _client = LumengateConfidentialTokenClient::new(&env, &contract_id);
}
