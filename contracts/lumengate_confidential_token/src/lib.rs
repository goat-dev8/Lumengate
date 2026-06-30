#![no_std]

use soroban_sdk::{contract, contractimpl, Address, Bytes, Env, Symbol, Vec};
use stellar_access::access_control::{self as access_control, AccessControl};
use stellar_tokens::confidential::{
    compliance::{
        storage::{set_compliance_config, ComplianceConfig},
        ComplianceHooks, ConfidentialCompliance,
    },
    storage as token_storage, ConfidentialAccount, ConfidentialToken, SpenderDelegation,
};

#[contract]
pub struct LumengateConfidentialToken;

#[contractimpl]
impl LumengateConfidentialToken {
    pub fn __constructor(
        e: &Env,
        admin: Address,
        underlying_asset: Address,
        verifier: Address,
        auditor: Address,
        policy: Address,
    ) {
        access_control::set_admin(e, &admin);
        token_storage::set_underlying_asset(e, &underlying_asset);
        token_storage::set_verifier(e, &verifier);
        token_storage::set_auditor(e, &auditor);
        token_storage::set_address_as_field_element(e);
        set_compliance_config(
            e,
            &ComplianceConfig {
                policy: Some(policy),
                sac_passthrough: true,
            },
        );
    }
}

#[contractimpl(contracttrait)]
impl ConfidentialToken for LumengateConfidentialToken {
    type Hooks = ComplianceHooks;
}

#[contractimpl(contracttrait)]
impl ConfidentialCompliance for LumengateConfidentialToken {
    fn freeze(e: &Env, account: Address, admin: Address) {
        admin.require_auth();
        stellar_tokens::confidential::compliance::storage::freeze(e, &account);
    }

    fn unfreeze(e: &Env, account: Address, admin: Address) {
        admin.require_auth();
        stellar_tokens::confidential::compliance::storage::unfreeze(e, &account);
    }

    fn set_compliance_config(e: &Env, config: ComplianceConfig, admin: Address) {
        admin.require_auth();
        set_compliance_config(e, &config);
    }
}

#[contractimpl(contracttrait)]
impl AccessControl for LumengateConfidentialToken {}

#[cfg(test)]
mod test;
