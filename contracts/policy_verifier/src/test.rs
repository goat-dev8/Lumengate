#![cfg(test)]
use soroban_sdk::{testutils::Address as _, Address, Env};

#[test]
fn policy_verifier_constructs() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let _id = env.register(crate::PolicyVerifier, (&admin,));
}
