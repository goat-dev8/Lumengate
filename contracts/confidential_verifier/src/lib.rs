#![no_std]

use soroban_sdk::{contract, contractimpl, symbol_short, Address, Bytes, Env, Symbol, Vec};
use stellar_access::access_control::{self as access_control, AccessControl};
use stellar_macros::only_role;
use stellar_tokens::confidential::verifier::{
    storage as verifier, CircuitType, ConfidentialVerifier,
};

const MANAGER_ROLE: Symbol = symbol_short!("manager");

#[contract]
pub struct ConfidentialVerifierContract;

#[contractimpl]
impl ConfidentialVerifierContract {
    pub fn __constructor(e: &Env, admin: Address, manager: Address) {
        access_control::set_admin(e, &admin);
        access_control::grant_role_no_auth(e, &manager, &MANAGER_ROLE, &admin);
    }
}

#[contractimpl(contracttrait)]
impl ConfidentialVerifier for ConfidentialVerifierContract {
    #[only_role(operator, "manager")]
    fn register_verification_key(e: &Env, circuit_type: CircuitType, vk: Bytes, operator: Address) {
        verifier::register_verification_key(e, circuit_type, &vk);
    }

    #[only_role(operator, "manager")]
    fn update_verification_key(
        e: &Env,
        circuit_type: CircuitType,
        new_vk: Bytes,
        operator: Address,
    ) {
        verifier::update_verification_key(e, circuit_type, &new_vk);
    }
}

#[contractimpl(contracttrait)]
impl AccessControl for ConfidentialVerifierContract {}

#[cfg(test)]
mod test;
