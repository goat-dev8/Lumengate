#![cfg(test)]
use super::{SessionKeyPolicyContract, SessionKeyPolicyContractClient};
use soroban_sdk::{testutils::Address as _, Address, Env, String, Vec};
use stellar_accounts::{
    policies::spending_limit::{self, SpendingLimitAccountParams},
    smart_account::{ContextRule, ContextRuleType, Signer},
};

fn sample_context_rule(env: &Env) -> ContextRule {
    ContextRule {
        id: 1,
        context_type: ContextRuleType::CallContract(Address::generate(env)),
        name: String::from_str(env, "session-key"),
        signers: Vec::new(env),
        signer_ids: Vec::new(env),
        policies: Vec::new(env),
        policy_ids: Vec::new(env),
        valid_until: None,
    }
}

#[test]
fn install_and_read_spending_limit_data() {
    let env = Env::default();
    env.mock_all_auths();
    let smart_account = Address::generate(&env);
    let contract_id = env.register(SessionKeyPolicyContract, ());
    let client = SessionKeyPolicyContractClient::new(&env, &contract_id);
    let context_rule = sample_context_rule(&env);
    let params = SpendingLimitAccountParams {
        spending_limit: 5_000_000,
        period_ledgers: 17_280,
    };

    env.as_contract(&contract_id, || {
        spending_limit::install(&env, &params, &context_rule, &smart_account);
    });

    let data = client.get_spending_limit_data(&context_rule.id, &smart_account);
    assert_eq!(data.spending_limit, 5_000_000);
    assert_eq!(data.period_ledgers, 17_280);
}

#[test]
fn set_spending_limit_updates_cap() {
    let env = Env::default();
    env.mock_all_auths();
    let smart_account = Address::generate(&env);
    let contract_id = env.register(SessionKeyPolicyContract, ());
    let client = SessionKeyPolicyContractClient::new(&env, &contract_id);
    let context_rule = sample_context_rule(&env);
    let params = SpendingLimitAccountParams {
        spending_limit: 1_000_000,
        period_ledgers: 100,
    };

    env.as_contract(&contract_id, || {
        spending_limit::install(&env, &params, &context_rule, &smart_account);
    });

    client.set_spending_limit(&2_000_000, &context_rule, &smart_account);
    let data = client.get_spending_limit_data(&context_rule.id, &smart_account);
    assert_eq!(data.spending_limit, 2_000_000);
}
