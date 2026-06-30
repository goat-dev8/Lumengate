#![cfg(test)]
use super::ConfidentialVerifierContract;
use soroban_sdk::{testutils::Address as _, Address, Env};

#[test]
fn confidential_verifier_constructs_with_roles() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let manager = Address::generate(&env);
    let _id = env.register(ConfidentialVerifierContract, (&admin, &manager));
}
