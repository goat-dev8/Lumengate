#![no_std]
use soroban_sdk::{contract, contracterror, contractevent, contractimpl, Address, BytesN, Env, Map, Symbol, Vec};
use stellar_access::access_control::{grant_role_no_auth, set_admin, AccessControl};
use stellar_macros::only_role;

#[contract]
pub struct IssuerRegistry;

#[contracterror]
#[repr(u32)]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum Error {
    NotAdmin = 1,
    IssuerExists = 2,
    IssuerNotFound = 3,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct IssuerAdded {
    pub issuer_id: u32,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct IssuerRevoked {
    pub issuer_id: u32,
}

#[contractimpl]
impl IssuerRegistry {
    pub fn __constructor(env: Env, admin: Address) {
        set_admin(&env, &admin);
        grant_role_no_auth(&env, &admin, &Symbol::new(&env, "issuer_admin"), &admin);
    }

    fn issuers(env: &Env) -> Map<u32, BytesN<64>> {
        env.storage()
            .persistent()
            .get(&Symbol::new(env, "issuers"))
            .unwrap_or(Map::new(env))
    }

    fn save_issuers(env: &Env, issuers: &Map<u32, BytesN<64>>) {
        env.storage()
            .persistent()
            .set(&Symbol::new(env, "issuers"), issuers);
    }

    #[only_role(caller, "issuer_admin")]
    pub fn add_issuer(
        env: Env,
        caller: Address,
        issuer_id: u32,
        pubkey: BytesN<64>,
    ) -> Result<(), Error> {
        let mut issuers = Self::issuers(&env);
        if issuers.contains_key(issuer_id) {
            return Err(Error::IssuerExists);
        }
        issuers.set(issuer_id, pubkey);
        Self::save_issuers(&env, &issuers);
        IssuerAdded { issuer_id }.publish(&env);
        Ok(())
    }

    #[only_role(caller, "issuer_admin")]
    pub fn revoke_issuer(env: Env, caller: Address, issuer_id: u32) -> Result<(), Error> {
        let mut issuers = Self::issuers(&env);
        if !issuers.contains_key(issuer_id) {
            return Err(Error::IssuerNotFound);
        }
        issuers.remove(issuer_id);
        Self::save_issuers(&env, &issuers);
        IssuerRevoked { issuer_id }.publish(&env);
        Ok(())
    }

    pub fn is_authorized(env: Env, issuer_id: u32) -> bool {
        Self::issuers(&env).contains_key(issuer_id)
    }

    pub fn get_pubkey(env: Env, issuer_id: u32) -> Option<BytesN<64>> {
        Self::issuers(&env).get(issuer_id)
    }
}

#[contractimpl(contracttrait)]
impl AccessControl for IssuerRegistry {}

#[cfg(test)]
mod test;
