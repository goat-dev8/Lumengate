#![no_std]
use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, token, Address, Bytes, Env, IntoVal, Symbol,
    Vec,
};
use stellar_access::access_control::{grant_role_no_auth, set_admin, AccessControl};
use stellar_macros::only_role;

/// Proof-gated USDC SAC transfers via RwaAdapter eligibility checks (CAP-73 pattern).
#[contract]
pub struct ComplianceSacAdmin;

#[contracterror]
#[repr(u32)]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum Error {
    NotAdmin = 1,
    VerificationFailed = 2,
    InvalidAmount = 3,
    InvalidAssetScope = 4,
}

const ASSET_USDC: u32 = 2;
const ASSET_EURC: u32 = 3;
const ACTION_SETTLEMENT: u32 = 1;

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UsdcTransferGated {
    pub from: Address,
    pub to: Address,
    pub amount: i128,
    pub policy_id: u32,
}

#[contractimpl]
impl ComplianceSacAdmin {
    pub fn __constructor(
        env: Env,
        admin: Address,
        adapter: Address,
        usdc_sac: Address,
        eurc_sac: Address,
        policy_id: u32,
    ) {
        set_admin(&env, &admin);
        grant_role_no_auth(
            &env,
            &admin,
            &Symbol::new(&env, "sac_admin"),
            &admin,
        );
        env.storage()
            .instance()
            .set(&Symbol::new(&env, "adapter"), &adapter);
        env.storage()
            .instance()
            .set(&Symbol::new(&env, "sac"), &usdc_sac);
        env.storage()
            .instance()
            .set(&Symbol::new(&env, "eurc_sac"), &eurc_sac);
        env.storage()
            .instance()
            .set(&Symbol::new(&env, "policy"), &policy_id);
    }

    fn adapter(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&Symbol::new(env, "adapter"))
            .expect("adapter not set")
    }

    fn sac(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&Symbol::new(env, "sac"))
            .expect("sac not set")
    }

    fn eurc_sac(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&Symbol::new(env, "eurc_sac"))
            .expect("eurc sac not set")
    }

    fn policy_id(env: &Env) -> u32 {
        env.storage()
            .instance()
            .get(&Symbol::new(env, "policy"))
            .unwrap_or(1u32)
    }

    fn field_bytes_to_u32(bytes: &[u8; 32]) -> u32 {
        let mut value: u128 = 0;
        for b in bytes.iter() {
            value = (value << 8) | (*b as u128);
        }
        if value > u32::MAX as u128 {
            return 0;
        }
        value as u32
    }

    fn policy_id_from_public_inputs(public_inputs: &Bytes) -> Result<u32, Error> {
        if public_inputs.len() < 96 {
            return Err(Error::VerificationFailed);
        }
        let slice = public_inputs.slice(64..96);
        let mut arr = [0u8; 32];
        slice.copy_into_slice(&mut arr);
        let id = Self::field_bytes_to_u32(&arr);
        if id == 0 {
            return Err(Error::VerificationFailed);
        }
        Ok(id)
    }

    fn public_input_u32(public_inputs: &Bytes, index: u32) -> Result<u32, Error> {
        let start = index * 32;
        let end = start + 32;
        if public_inputs.len() < end {
            return Err(Error::VerificationFailed);
        }
        let slice = public_inputs.slice(start..end);
        let mut arr = [0u8; 32];
        slice.copy_into_slice(&mut arr);
        let value = Self::field_bytes_to_u32(&arr);
        if value == 0 {
            return Err(Error::VerificationFailed);
        }
        Ok(value)
    }

    fn require_asset_scope(public_inputs: &Bytes, asset_id: u32) -> Result<(), Error> {
        if Self::public_input_u32(public_inputs, 3)? != asset_id {
            return Err(Error::InvalidAssetScope);
        }
        if Self::public_input_u32(public_inputs, 4)? != ACTION_SETTLEMENT {
            return Err(Error::InvalidAssetScope);
        }
        Ok(())
    }

    pub fn eurc_sac_address(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&Symbol::new(&env, "eurc_sac"))
            .expect("eurc sac not set")
    }

    pub fn sac_address(env: Env) -> Address {
        Self::sac(&env)
    }

    pub fn adapter_address(env: Env) -> Address {
        Self::adapter(&env)
    }

    pub fn balance(env: Env, id: Address) -> i128 {
        token::Client::new(&env, &Self::sac(&env)).balance(&id)
    }

    /// Transfer USDC from `from` after RwaAdapter passport verification.
    pub fn transfer_compliant(
        env: Env,
        from: Address,
        to: Address,
        amount: i128,
        proof: Bytes,
        public_inputs: Bytes,
    ) -> Result<(), Error> {
        from.require_auth();
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        let adapter = Self::adapter(&env);
        let policy_id = Self::policy_id_from_public_inputs(&public_inputs)?;
        Self::require_asset_scope(&public_inputs, ASSET_USDC)?;
        let mut args = Vec::new(&env);
        args.push_back(policy_id.into_val(&env));
        args.push_back(proof.into_val(&env));
        args.push_back(public_inputs.into_val(&env));
        let ok: bool = env.invoke_contract(
            &adapter,
            &Symbol::new(&env, "verify_passport"),
            args,
        );
        if !ok {
            return Err(Error::VerificationFailed);
        }

        // CAP-0073: idempotent trustline setup before transfer (no-op if trustline exists).
        let sac = Self::sac(&env);
        token::StellarAssetClient::new(&env, &sac).trust(&to);
        token::Client::new(&env, &sac).transfer(&from, &to, &amount);

        UsdcTransferGated {
            from: from.clone(),
            to: to.clone(),
            amount,
            policy_id,
        }
        .publish(&env);

        Ok(())
    }

    /// EURC settlement with the same eligibility gate and CAP-0073 trust().
    pub fn transfer_compliant_eurc(
        env: Env,
        from: Address,
        to: Address,
        amount: i128,
        proof: Bytes,
        public_inputs: Bytes,
    ) -> Result<(), Error> {
        from.require_auth();
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        let adapter = Self::adapter(&env);
        let policy_id = Self::policy_id_from_public_inputs(&public_inputs)?;
        Self::require_asset_scope(&public_inputs, ASSET_EURC)?;
        let mut args = Vec::new(&env);
        args.push_back(policy_id.into_val(&env));
        args.push_back(proof.into_val(&env));
        args.push_back(public_inputs.into_val(&env));
        let ok: bool = env.invoke_contract(
            &adapter,
            &Symbol::new(&env, "verify_passport"),
            args,
        );
        if !ok {
            return Err(Error::VerificationFailed);
        }

        let sac = Self::eurc_sac(&env);
        token::StellarAssetClient::new(&env, &sac).trust(&to);
        token::Client::new(&env, &sac).transfer(&from, &to, &amount);

        UsdcTransferGated {
            from: from.clone(),
            to: to.clone(),
            amount,
            policy_id,
        }
        .publish(&env);

        Ok(())
    }

    #[only_role(caller, "sac_admin")]
    pub fn set_adapter(env: Env, caller: Address, adapter: Address) -> Result<(), Error> {
        env.storage()
            .instance()
            .set(&Symbol::new(&env, "adapter"), &adapter);
        Ok(())
    }
}

#[contractimpl(contracttrait)]
impl AccessControl for ComplianceSacAdmin {}

#[cfg(test)]
mod test {
    use super::{ComplianceSacAdmin, ComplianceSacAdminClient};
    use soroban_sdk::{testutils::Address as _, Address, Env};

    #[test]
    fn stores_sac_address() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let adapter = Address::generate(&env);
        let sac = Address::generate(&env);
        let eurc = Address::generate(&env);
        let id = env.register(ComplianceSacAdmin, (&admin, &adapter, &sac, &eurc, &1u32));
        let client = ComplianceSacAdminClient::new(&env, &id);
        assert_eq!(client.sac_address(), sac);
    }

    #[test]
    fn stores_eurc_sac_address() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let adapter = Address::generate(&env);
        let sac = Address::generate(&env);
        let eurc = Address::generate(&env);
        let id = env.register(ComplianceSacAdmin, (&admin, &adapter, &sac, &eurc, &1u32));
        let client = ComplianceSacAdminClient::new(&env, &id);
        assert_eq!(client.eurc_sac_address(), eurc);
    }

    #[test]
    fn stores_adapter_address() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let adapter = Address::generate(&env);
        let sac = Address::generate(&env);
        let eurc = Address::generate(&env);
        let id = env.register(ComplianceSacAdmin, (&admin, &adapter, &sac, &eurc, &2u32));
        let client = ComplianceSacAdminClient::new(&env, &id);
        assert_eq!(client.adapter_address(), adapter);
    }
}
