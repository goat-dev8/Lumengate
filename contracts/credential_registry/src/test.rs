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
    let (r, rr) = client.get_roots();
    assert_eq!(r, root);
    assert_eq!(rr, rev);
}
