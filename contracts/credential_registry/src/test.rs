#![cfg(test)]
use super::{CredentialRegistry, CredentialRegistryClient};
use soroban_sdk::{testutils::Address as _, Address, BytesN, Env};

#[test]
fn set_and_get_roots() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let issuer_reg = Address::generate(&env);
    let contract_id = env.register(CredentialRegistry, (&admin, &issuer_reg));
    let client = CredentialRegistryClient::new(&env, &contract_id);

    let root = BytesN::from_array(&env, &[2u8; 32]);
    let rev = BytesN::from_array(&env, &[3u8; 32]);
    client.set_root(&admin, &root);
    client.set_revocation_root(&admin, &rev);
    let note = BytesN::from_array(&env, &[4u8; 32]);
    client.set_note_root(&admin, &note);
    let (r, rr, nr) = client.get_roots();
    assert_eq!(r, root);
    assert_eq!(rr, rev);
    assert_eq!(nr, note);
}

#[test]
fn get_issuer_registry_returns_constructor_address() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let issuer_reg = Address::generate(&env);
    let contract_id = env.register(CredentialRegistry, (&admin, &issuer_reg));
    let client = CredentialRegistryClient::new(&env, &contract_id);

    assert_eq!(client.get_issuer_registry(), issuer_reg);
}

#[test]
fn note_root_defaults_to_zero_before_set() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let issuer_reg = Address::generate(&env);
    let contract_id = env.register(CredentialRegistry, (&admin, &issuer_reg));
    let client = CredentialRegistryClient::new(&env, &contract_id);

    let (root, rev_root, note_root) = client.get_roots();
    assert_eq!(root, BytesN::from_array(&env, &[0u8; 32]));
    assert_eq!(rev_root, BytesN::from_array(&env, &[0u8; 32]));
    assert_eq!(note_root, BytesN::from_array(&env, &[0u8; 32]));
}
