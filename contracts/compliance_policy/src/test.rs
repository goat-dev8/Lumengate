#![cfg(test)]
use super::CompliancePolicy;
use soroban_sdk::Env;

#[test]
fn compliance_policy_registers() {
    let env = Env::default();
    env.mock_all_auths();
    let _id = env.register(CompliancePolicy, ());
}
