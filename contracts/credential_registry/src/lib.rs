#![no_std]
use soroban_sdk::{contract, contracterror, contractevent, contractimpl, contracttrait, Address, BytesN, Env, Map, Symbol, Vec};
use stellar_access::access_control::{grant_role_no_auth, set_admin, AccessControl};
use stellar_macros::only_role;

#[contract]
pub struct CredentialRegistry;

#[contracterror]
#[repr(u32)]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum Error {
    UnauthorizedIssuer = 1,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RootUpdated {
    pub root: BytesN<32>,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RevocationRootUpdated {
    pub revocation_root: BytesN<32>,
}

#[contractimpl]
impl CredentialRegistry {
    pub fn __constructor(env: Env, admin: Address, issuer_registry: Address) {
        set_admin(&env, &admin);
        grant_role_no_auth(
            &env,
            &admin,
            &Symbol::new(&env, "registry_admin"),
            &admin,
        );
        grant_role_no_auth(
            &env,
            &admin,
            &Symbol::new(&env, "root_admin"),
            &admin,
        );
        env.storage()
            .instance()
            .set(&Symbol::new(&env, "issuer_reg"), &issuer_registry);
        let empty = BytesN::from_array(&env, &[0u8; 32]);
        env.storage()
            .persistent()
            .set(&Symbol::new(&env, "root"), &empty);
        env.storage()
            .persistent()
            .set(&Symbol::new(&env, "rev_root"), &empty);
    }

    fn issuer_registry(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&Symbol::new(env, "issuer_reg"))
            .expect("issuer registry not set")
    }

    fn is_authorized_issuer(env: &Env, issuer: &Address) -> bool {
        let allowlist: Map<Address, bool> = env
            .storage()
            .persistent()
            .get(&Symbol::new(env, "allow"))
            .unwrap_or(Map::new(env));
        allowlist.get(issuer.clone()).unwrap_or(false)
    }

    #[only_role(caller, "registry_admin")]
    pub fn authorize_issuer(env: Env, caller: Address, issuer: Address) -> Result<(), Error> {
        let mut allowlist: Map<Address, bool> = env
            .storage()
            .persistent()
            .get(&Symbol::new(&env, "allow"))
            .unwrap_or(Map::new(&env));
        allowlist.set(issuer, true);
        env.storage()
            .persistent()
            .set(&Symbol::new(&env, "allow"), &allowlist);
        Ok(())
    }

    #[only_role(caller, "root_admin")]
    pub fn set_root(env: Env, caller: Address, root: BytesN<32>) -> Result<(), Error> {
        env.storage()
            .persistent()
            .set(&Symbol::new(&env, "root"), &root);
        let mut updates: Map<Address, u64> = env
            .storage()
            .persistent()
            .get(&Symbol::new(&env, "updates"))
            .unwrap_or(Map::new(&env));
        updates.set(caller, env.ledger().timestamp());
        env.storage()
            .persistent()
            .set(&Symbol::new(&env, "updates"), &updates);
        RootUpdated { root: root.clone() }.publish(&env);
        Ok(())
    }

    #[only_role(caller, "root_admin")]
    pub fn set_revocation_root(
        env: Env,
        caller: Address,
        revocation_root: BytesN<32>,
    ) -> Result<(), Error> {
        env.storage()
            .persistent()
            .set(&Symbol::new(&env, "rev_root"), &revocation_root);
        RevocationRootUpdated {
            revocation_root: revocation_root.clone(),
        }
        .publish(&env);
        Ok(())
    }

    pub fn get_roots(env: Env) -> (BytesN<32>, BytesN<32>) {
        let root = env
            .storage()
            .persistent()
            .get(&Symbol::new(&env, "root"))
            .unwrap_or(BytesN::from_array(&env, &[0u8; 32]));
        let rev = env
            .storage()
            .persistent()
            .get(&Symbol::new(&env, "rev_root"))
            .unwrap_or(BytesN::from_array(&env, &[0u8; 32]));
        (root, rev)
    }

    pub fn get_issuer_registry(env: Env) -> Address {
        Self::issuer_registry(&env)
    }
}

#[contractimpl(contracttrait)]
impl AccessControl for CredentialRegistry {}

#[cfg(test)]
mod test;
