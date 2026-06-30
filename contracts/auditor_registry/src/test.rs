#![cfg(test)]
use super::{AuditorRegistry, AuditorRegistryClient};
use soroban_sdk::{testutils::Address as _, Address, BytesN, Env, String};

#[test]
fn register_and_verify_viewing_key() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let contract_id = env.register(AuditorRegistry, (&admin,));
    let client = AuditorRegistryClient::new(&env, &contract_id);

    let hash = BytesN::from_array(&env, &[7u8; 32]);
    client.register_auditor(&admin, &1u32, &hash, &String::from_str(&env, "regulator-a"));

    assert!(client.is_registered(&1u32));
    assert!(client.verify_viewing_key(&1u32, &hash));
    assert!(!client.verify_viewing_key(&1u32, &BytesN::from_array(&env, &[1u8; 32])));
}

#[test]
#[should_panic(expected = "Error(Contract, #2)")]
fn duplicate_auditor_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let contract_id = env.register(AuditorRegistry, (&admin,));
    let client = AuditorRegistryClient::new(&env, &contract_id);

    let hash = BytesN::from_array(&env, &[5u8; 32]);
    client.register_auditor(&admin, &2u32, &hash, &String::from_str(&env, "dup"));
    client.register_auditor(&admin, &2u32, &hash, &String::from_str(&env, "dup2"));
}

#[test]
fn is_registered_false_for_unknown_auditor() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let contract_id = env.register(AuditorRegistry, (&admin,));
    let client = AuditorRegistryClient::new(&env, &contract_id);

    assert!(!client.is_registered(&77u32));
}

#[test]
fn record_disclosure_accepts_matching_viewing_key() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let contract_id = env.register(AuditorRegistry, (&admin,));
    let client = AuditorRegistryClient::new(&env, &contract_id);

    let hash = BytesN::from_array(&env, &[9u8; 32]);
    client.register_auditor(&admin, &5u32, &hash, &String::from_str(&env, "audit"));

    let tx = BytesN::from_array(&env, &[1u8; 32]);
    let nullifier = BytesN::from_array(&env, &[2u8; 32]);
    client.record_disclosure(&5u32, &hash, &tx, &nullifier);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn record_disclosure_rejects_viewing_key_mismatch() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let contract_id = env.register(AuditorRegistry, (&admin,));
    let client = AuditorRegistryClient::new(&env, &contract_id);

    let hash = BytesN::from_array(&env, &[9u8; 32]);
    client.register_auditor(&admin, &6u32, &hash, &String::from_str(&env, "audit"));

    let wrong = BytesN::from_array(&env, &[8u8; 32]);
    let tx = BytesN::from_array(&env, &[1u8; 32]);
    let nullifier = BytesN::from_array(&env, &[2u8; 32]);
    client.record_disclosure(&6u32, &wrong, &tx, &nullifier);
}
