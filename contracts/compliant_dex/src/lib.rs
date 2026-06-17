#![no_std]
use soroban_sdk::{contract, contracterror, contractevent, contractimpl, token, Address, Bytes, Env, IntoVal, Symbol, Vec};

/// CompliantDEX: proof-gated USDC settlement via shared RwaAdapter (infrastructure consumer #1).
#[contract]
pub struct CompliantDex;

#[contracterror]
#[repr(u32)]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum Error {
    NotAdmin = 1,
    VerificationFailed = 2,
    InvalidAmount = 3,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CompliantSwap {
    pub trader: Address,
    pub recipient: Address,
    pub amount: i128,
    pub policy_id: u32,
}

#[contractimpl]
impl CompliantDex {
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

    /// Swap USDC to recipient after passport verification (direct SAC transfer gate).
    pub fn swap_compliant(
        env: Env,
        trader: Address,
        recipient: Address,
        amount: i128,
        proof: Bytes,
        public_inputs: Bytes,
    ) -> Result<(), Error> {
        trader.require_auth();
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        let policy_id: u32 = env
            .storage()
            .instance()
            .get(&Symbol::new(&env, "policy"))
            .unwrap_or(1u32);

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
        token::StellarAssetClient::new(&env, &sac).trust(&recipient);
        token::Client::new(&env, &sac).transfer(&trader, &recipient, &amount);

        CompliantSwap {
            trader,
            recipient,
            amount,
            policy_id,
        }
        .publish(&env);
        Ok(())
    }
}
