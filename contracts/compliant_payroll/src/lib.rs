#![no_std]
use soroban_sdk::{contract, contracterror, contractevent, contractimpl, token, Address, Bytes, Env, IntoVal, Symbol, Vec};

/// CompliantPayroll: proof-gated payroll payout via shared RwaAdapter (infrastructure consumer #2).
#[contract]
pub struct CompliantPayroll;

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
const ACTION_SETTLEMENT: u32 = 1;

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CompliantPayout {
    pub payer: Address,
    pub employee: Address,
    pub amount: i128,
    pub policy_id: u32,
}

#[contractimpl]
impl CompliantPayroll {
    pub fn __constructor(
        env: Env,
        admin: Address,
        adapter: Address,
        sac: Address,
        policy_id: u32,
    ) {
        env.storage()
            .instance()
            .set(&Symbol::new(&env, "admin"), &admin);
        env.storage()
            .instance()
            .set(&Symbol::new(&env, "adapter"), &adapter);
        env.storage()
            .instance()
            .set(&Symbol::new(&env, "sac"), &sac);
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

    fn require_usdc_scope(public_inputs: &Bytes) -> Result<(), Error> {
        if Self::public_input_u32(public_inputs, 3)? != ASSET_USDC {
            return Err(Error::InvalidAssetScope);
        }
        if Self::public_input_u32(public_inputs, 4)? != ACTION_SETTLEMENT {
            return Err(Error::InvalidAssetScope);
        }
        Ok(())
    }

    pub fn pay_compliant(
        env: Env,
        payer: Address,
        employee: Address,
        amount: i128,
        proof: Bytes,
        public_inputs: Bytes,
    ) -> Result<(), Error> {
        payer.require_auth();
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        let policy_id: u32 = env
            .storage()
            .instance()
            .get(&Symbol::new(&env, "policy"))
            .unwrap_or(1u32);
        Self::require_usdc_scope(&public_inputs)?;

        let adapter = Self::adapter(&env);
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

        let sac = Self::sac(&env);
        token::StellarAssetClient::new(&env, &sac).trust(&employee);
        token::Client::new(&env, &sac).transfer(&payer, &employee, &amount);

        CompliantPayout {
            payer,
            employee,
            amount,
            policy_id,
        }
        .publish(&env);
        Ok(())
    }
}
