#![cfg(test)]
use super::{IssuerRegistry, IssuerRegistryClient};
use soroban_sdk::{testutils::Address as _, Address, BytesN, Env};

fn sample_pubkey(env: &Env) -> BytesN<64> {
    BytesN::from_array(env, &[1u8; 64])
}

#[test]
fn add_and_authorize_issuer() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let contract_id = env.register(IssuerRegistry, (&admin,));
    let client = IssuerRegistryClient::new(&env, &contract_id);

    client.add_issuer(&admin, &1u32, &sample_pubkey(&env));
    assert!(client.is_authorized(&1u32));
    assert!(!client.is_authorized(&2u32));
}

#[test]
fn revoke_issuer() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let contract_id = env.register(IssuerRegistry, (&admin,));
    let client = IssuerRegistryClient::new(&env, &contract_id);

    client.add_issuer(&admin, &1u32, &sample_pubkey(&env));
    client.revoke_issuer(&admin, &1u32);
    assert!(!client.is_authorized(&1u32));
}

#[test]
#[should_panic(expected = "Error(Contract, #2)")]
fn duplicate_issuer_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let contract_id = env.register(IssuerRegistry, (&admin,));
    let client = IssuerRegistryClient::new(&env, &contract_id);

    client.add_issuer(&admin, &1u32, &sample_pubkey(&env));
    client.add_issuer(&admin, &1u32, &sample_pubkey(&env));
}

#[test]
fn get_pubkey_missing_returns_none() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let contract_id = env.register(IssuerRegistry, (&admin,));
    let client = IssuerRegistryClient::new(&env, &contract_id);

    assert!(client.get_pubkey(&99u32).is_none());
}
