#![no_std]
use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, Address, BytesN, Env, Map, String, Symbol,
    Vec,
};
use stellar_access::access_control::{grant_role_no_auth, set_admin, AccessControl};
use stellar_macros::only_role;

#[contract]
pub struct AuditorRegistry;

#[contracterror]
#[repr(u32)]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum Error {
    NotAdmin = 1,
    AuditorExists = 2,
    AuditorNotFound = 3,
    ViewingKeyMismatch = 4,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AuditorRegistered {
    pub auditor_id: u32,
    pub label: String,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DisclosureRecorded {
    pub auditor_id: u32,
    pub tx_hash: BytesN<32>,
    pub nullifier: BytesN<32>,
}

#[contractimpl]
impl AuditorRegistry {
    pub fn __constructor(env: Env, admin: Address) {
        set_admin(&env, &admin);
        grant_role_no_auth(
            &env,
            &admin,
            &Symbol::new(&env, "auditor_admin"),
            &admin,
        );
    }

    fn auditors(env: &Env) -> Map<u32, BytesN<32>> {
        env.storage()
            .persistent()
            .get(&Symbol::new(env, "auditors"))
            .unwrap_or(Map::new(env))
    }

    fn save_auditors(env: &Env, auditors: &Map<u32, BytesN<32>>) {
        env.storage()
            .persistent()
            .set(&Symbol::new(env, "auditors"), auditors);
    }

    fn labels(env: &Env) -> Map<u32, String> {
        env.storage()
            .persistent()
            .get(&Symbol::new(env, "labels"))
            .unwrap_or(Map::new(env))
    }

    fn save_labels(env: &Env, labels: &Map<u32, String>) {
        env.storage()
            .persistent()
            .set(&Symbol::new(env, "labels"), labels);
    }

    #[only_role(caller, "auditor_admin")]
    pub fn register_auditor(
        env: Env,
        caller: Address,
        auditor_id: u32,
        viewing_key_hash: BytesN<32>,
        label: String,
    ) -> Result<(), Error> {
        let mut auditors = Self::auditors(&env);
        if auditors.contains_key(auditor_id) {
            return Err(Error::AuditorExists);
        }
        auditors.set(auditor_id, viewing_key_hash);
        Self::save_auditors(&env, &auditors);
        let mut labels = Self::labels(&env);
        labels.set(auditor_id, label.clone());
        Self::save_labels(&env, &labels);
        AuditorRegistered { auditor_id, label }.publish(&env);
        Ok(())
    }

    pub fn verify_viewing_key(env: Env, auditor_id: u32, viewing_key_hash: BytesN<32>) -> bool {
        Self::auditors(&env)
            .get(auditor_id)
            .map(|stored| stored == viewing_key_hash)
            .unwrap_or(false)
    }

    pub fn is_registered(env: Env, auditor_id: u32) -> bool {
        Self::auditors(&env).contains_key(auditor_id)
    }

    pub fn record_disclosure(
        env: Env,
        auditor_id: u32,
        viewing_key_hash: BytesN<32>,
        tx_hash: BytesN<32>,
        nullifier: BytesN<32>,
    ) -> Result<(), Error> {
        let stored = Self::auditors(&env)
            .get(auditor_id)
            .ok_or(Error::AuditorNotFound)?;
        if stored != viewing_key_hash {
            return Err(Error::ViewingKeyMismatch);
        }
        DisclosureRecorded {
            auditor_id,
            tx_hash,
            nullifier,
        }
        .publish(&env);
        Ok(())
    }
}

#[contractimpl(contracttrait)]
impl AccessControl for AuditorRegistry {}
