/**
 * SmartAccountKit - Client-side SDK for Smart Account Management
 *
 * This is the main entry point for client applications to create and manage
 * smart wallets secured by WebAuthn passkeys.
 */
import type { AuthenticationResponseJSON } from "@simplewebauthn/browser";
import { xdr, rpc, contract } from "@stellar/stellar-sdk";
declare const RpcServer: typeof rpc.Server;
import type { SmartAccountConfig, CreateWalletResult, ConnectWalletResult, TransactionResult, SubmissionMethod } from "./types";
import { Client as SmartAccountClient } from "smart-account-kit-bindings";
import { SmartAccountEventEmitter } from "./events";
import { ExternalSignerManager } from "./external-signers";
import { IndexerClient, type IndexedContractSummary, type ContractDetailsResponse } from "./indexer";
import { RelayerClient } from "./relayer";
import { SignerManager as SignerManagerClass, ContextRuleManager as ContextRuleManagerClass, PolicyManager as PolicyManagerClass, CredentialManager as CredentialManagerClass, MultiSignerManager as MultiSignerManagerClass } from "./managers";
export type { SignerManager, ContextRuleManager, PolicyManager, CredentialManager, MultiSignerManager, } from "./managers";
export type { MultiSignerOptions, } from "./managers/multi-signer-manager";
/**
 * External signer management interface.
 *
 * Provides unified management of G-address signers (Stellar accounts) for
 * multi-signature operations. Supports two methods:
 * 1. Raw secret key - stored in memory only (never persisted)
 * 2. External wallet via StellarWalletsKit (optional)
 *
 * @example
 * ```typescript
 * // Add from raw secret key (memory-only)
 * const { address } = kit.externalSigners.addFromSecret("S...");
 *
 * // Add from external wallet (if SWK configured)
 * const wallet = await kit.externalSigners.addFromWallet();
 *
 * // Check if we can sign for an address
 * if (kit.externalSigners.canSignFor("G...")) {
 *   // SDK will automatically use this signer during multi-sig operations
 * }
 * ```
 */
/**
 * SmartAccountKit - Main client SDK for smart account management
 *
 * @example
 * ```typescript
 * const kit = new SmartAccountKit({
 *   rpcUrl: 'https://soroban-testnet.stellar.org',
 *   networkPassphrase: 'Test SDF Network ; September 2015',
 *   accountWasmHash: '...',
 *   webauthnVerifierAddress: 'C...',
 * });
 *
 * // Create a new wallet
 * const { credentialId, contractId, signedTransaction } = await kit.createWallet('MyApp', 'user@example.com');
 *
 * // Connect to existing wallet
 * const { contractId } = await kit.connectWallet({ credentialId: 'savedCredentialId' });
 *
 * // Sign a transaction
 * const signedTx = await kit.sign(transaction);
 * ```
 */
export declare class SmartAccountKit {
    readonly rpcUrl: string;
    readonly networkPassphrase: string;
    readonly rpc: InstanceType<typeof RpcServer>;
    private readonly accountWasmHash;
    private readonly webauthnVerifierAddress;
    private readonly timeoutInSeconds;
    private readonly signatureExpirationLedgers;
    private readonly probeRuleIds?;
    private readonly rpId?;
    private readonly rpName;
    private readonly webAuthn;
    private readonly storage;
    private readonly externalWalletAdapter?;
    private readonly sessionExpiryMs;
    private _credentialId?;
    private _contractId?;
    /** Smart account contract client (after connection) */
    wallet?: SmartAccountClient;
    private readonly deployerKeypair;
    /**
     * Signer management methods.
     * Add, remove, and manage signers on context rules.
     */
    readonly signers: SignerManagerClass;
    /**
     * Context rule management methods.
     * Create, read, update, and delete context rules.
     */
    readonly rules: ContextRuleManagerClass;
    /**
     * Policy management methods.
     * Add and remove policies from context rules.
     */
    readonly policies: PolicyManagerClass;
    /**
     * Credential storage management methods.
     * Manage locally stored credentials for pending deployments.
     */
    readonly credentials: CredentialManagerClass;
    /**
     * Event emitter for credential lifecycle events.
     * Subscribe to events like walletConnected, credentialCreated, etc.
     *
     * @example
     * ```typescript
     * kit.events.on('walletConnected', ({ contractId }) => {
     *   console.log('Connected to wallet:', contractId);
     * });
     * ```
     */
    readonly events: SmartAccountEventEmitter;
    /**
     * Multi-signer operations.
     * Execute transactions that require multiple signers (passkeys + external wallets).
     *
     * @example
     * ```typescript
     * const selectedSigners = kit.multiSigners.buildSelectedSigners(signers, activeCredentialId);
     * const result = await kit.multiSigners.transfer(
     *   tokenContract, recipient, amount, selectedSigners
     * );
     * ```
     */
    readonly multiSigners: MultiSignerManagerClass;
    /**
     * External signer management.
     * Unified interface for managing G-address signers (Stellar accounts) for
     * multi-signature operations.
     *
     * Supports two methods of adding signers:
     * 1. Raw secret key (Keypair) - stored in memory only
     * 2. External wallet via StellarWalletsKit (if configured)
     *
     * @example
     * ```typescript
     * // Add from raw secret key (memory-only, lost on refresh)
     * const { address } = kit.externalSigners.addFromSecret("S...");
     *
     * // Add from external wallet (if SWK configured)
     * const wallet = await kit.externalSigners.addFromWallet();
     *
     * // List all external signers
     * const signers = kit.externalSigners.getAll();
     *
     * // Check if we can sign for an address
     * if (kit.externalSigners.canSignFor("G...")) {
     *   // SDK will automatically use this signer during multi-sig operations
     * }
     * ```
     */
    readonly externalSigners: ExternalSignerManager;
    /**
     * Indexer client for discovering smart account contracts.
     *
     * The indexer enables reverse lookups from signer credentials to contracts,
     * which is essential for discovering which contracts a user has access to.
     *
     * This is automatically configured for known networks (testnet and mainnet) if not
     * explicitly disabled via `indexerUrl: false` in the config.
     *
     * @example
     * ```typescript
     * // Check if indexer is available
     * if (kit.indexer) {
     *   // Discover contracts by credential ID
     *   const { contracts } = await kit.indexer.lookupByCredentialId(credentialId);
     *
     *   // Discover contracts by G-address
     *   const { contracts } = await kit.indexer.lookupByAddress('GABCD...');
     *
     *   // Get full contract details
     *   const details = await kit.indexer.getContractDetails('CABC...');
     * }
     * ```
     */
    readonly indexer: IndexerClient | null;
    /**
     * Optional Relayer client for fee-sponsored transaction submission.
     *
     * When configured, allows submitting transactions without paying fees -
     * the fees are sponsored by the Relayer proxy service.
     *
     * The Relayer uses channel accounts for parallel transaction submission with
     * automatic fee bumping, eliminating sequence number conflicts.
     *
     * @example
     * ```typescript
     * // Configure Relayer in the kit
     * const kit = new SmartAccountKit({
     *   // ... other config
     *   relayerUrl: 'https://my-relayer-proxy.example.com',
     * });
     *
     * // Submit a signed transaction via Relayer (fee-bump)
     * if (kit.relayer) {
     *   const result = await kit.relayer.sendXdr(signedTransaction);
     *   console.log('Hash:', result.hash);
     * }
     * ```
     */
    readonly relayer: RelayerClient | null;
    constructor(config: SmartAccountConfig);
    /** Currently connected credential ID (Base64URL encoded) */
    get credentialId(): string | undefined;
    /** Currently connected contract ID */
    get contractId(): string | undefined;
    /** Check if connected to a wallet */
    get isConnected(): boolean;
    /**
     * Get the deployer public key (used as fee payer for transactions)
     *
     * This is a deterministic keypair derived from the network passphrase,
     * shared across all SDK instances on the same network.
     */
    get deployerPublicKey(): string;
    /**
     * Discover smart account contracts associated with a credential ID.
     *
     * This uses the indexer to perform a reverse lookup from the credential ID
     * to find all contracts where this credential is registered as a signer.
     *
     * @param credentialId - The credential ID to look up (hex or base64url encoded)
     * @returns Array of contract summaries, or null if indexer is not available
     *
     * @example
     * ```typescript
     * // After WebAuthn authentication, find contracts for the credential
     * const contracts = await kit.discoverContractsByCredential(credentialId);
     * if (contracts && contracts.length > 0) {
     *   // User has access to these contracts
     *   console.log(`Found ${contracts.length} smart accounts`);
     * }
     * ```
     */
    discoverContractsByCredential(credentialId: string): Promise<IndexedContractSummary[] | null>;
    /**
     * Discover smart account contracts associated with a Stellar address.
     *
     * This works for both G-addresses (Delegated signers) and C-addresses
     * (External signer verifier contracts).
     *
     * @param address - Stellar address (G... or C...)
     * @returns Array of contract summaries, or null if indexer is not available
     *
     * @example
     * ```typescript
     * // Find contracts where this G-address is a delegated signer
     * const contracts = await kit.discoverContractsByAddress('GABCD...');
     * ```
     */
    discoverContractsByAddress(address: string): Promise<IndexedContractSummary[] | null>;
    /**
     * Get detailed information about a smart account contract from the indexer.
     *
     * Returns the current state including active context rules, signers, and policies.
     * This is useful for displaying contract details and discovering active rule IDs.
     *
     * Note: the SDK relies on the indexer for active rule discovery because the
     * contract does not expose an iterator for active rule IDs.
     *
     * @param contractId - Smart account contract address (C...)
     * @returns Contract details or null if not found/indexer unavailable
     */
    getContractDetailsFromIndexer(contractId: string): Promise<ContractDetailsResponse | null>;
    private getActiveContractDetailsFromIndexer;
    /**
     * Require that a wallet is connected and return the wallet client and contract ID.
     * Throws if not connected.
     * @internal
     */
    private requireWallet;
    /**
     * Initialize the wallet client for a contract.
     * @internal
     */
    private initializeWallet;
    /**
     * Update connection state and initialize wallet client.
     * @internal
     */
    private setConnectedState;
    /**
     * Clear connection state.
     * @internal
     */
    private clearConnectedState;
    /**
     * Sign an assembled transaction with the deployer keypair.
     * @internal
     */
    private signWithDeployer;
    /**
     * Calculate expiration ledger from current ledger.
     * @internal
     */
    private calculateExpiration;
    /**
     * Submit a deployment transaction and update credential storage.
     * On success, deletes the credential from storage.
     * On failure, marks it as failed for retry.
     *
     * Deployment uses source_account auth (envelope signature). When using Relayer,
     * the signed XDR is submitted for fee-bumping. The inner tx signature is preserved.
     *
     * @internal
     */
    private submitDeploymentTx;
    /**
     * Create a new smart wallet with a passkey as the primary signer
     *
     * @param appName - Application name (displayed to user during passkey creation)
     * @param userName - User identifier (displayed to user during passkey creation)
     * @param options - Additional options
     * @returns Wallet creation result with credential ID, contract ID, and signed transaction
     */
    createWallet(appName: string, userName: string, options?: {
        nickname?: string;
        authenticatorSelection?: {
            authenticatorAttachment?: "platform" | "cross-platform";
            residentKey?: "discouraged" | "preferred" | "required";
            userVerification?: "discouraged" | "preferred" | "required";
        };
        /** If true, automatically submit and wait for confirmation. Default: false */
        autoSubmit?: boolean;
        /** If true and on testnet, fund the wallet via Friendbot after creation. Requires nativeTokenContract. */
        autoFund?: boolean;
        /** Native XLM token SAC address (required for autoFund) */
        nativeTokenContract?: string;
        /** Force a specific submission method (relayer or rpc) */
        forceMethod?: SubmissionMethod;
    }): Promise<CreateWalletResult & {
        submitResult?: TransactionResult;
        fundResult?: TransactionResult & {
            amount?: number;
        };
    }>;
    /**
     * Create a passkey without deploying a wallet.
     * Used internally for wallet creation and adding passkey signers.
     *
     * @internal
     */
    private createPasskey;
    /**
     * Authenticate with a passkey without connecting to a specific contract.
     *
     * This is useful when you need to:
     * 1. Get the credential ID first
     * 2. Use the indexer to discover which contracts the passkey has access to
     * 3. Then connect to a specific contract using connectWallet({ contractId, credentialId })
     *
     * @returns The credential ID from the selected passkey
     *
     * @example
     * ```typescript
     * // Step 1: Authenticate to get credential ID
     * const { credentialId } = await kit.authenticatePasskey();
     *
     * // Step 2: Discover contracts via indexer
     * const contracts = await kit.discoverContractsByCredential(credentialId);
     *
     * // Step 3: Let user choose or connect to the first one
     * if (contracts && contracts.length > 0) {
     *   await kit.connectWallet({
     *     contractId: contracts[0].contract_id,
     *     credentialId
     *   });
     * }
     * ```
     */
    authenticatePasskey(): Promise<{
        credentialId: string;
        rawResponse: AuthenticationResponseJSON;
    }>;
    /**
     * Connect to an existing smart wallet
     *
     * Behavior based on options:
     * - No options: Silent restore from storage, returns null if no stored session
     * - `{ prompt: true }`: Try stored session first, prompt user if none
     * - `{ fresh: true }`: Ignore stored session, always prompt user
     * - `{ credentialId }`: Connect using specific credential ID
     * - `{ contractId }`: Connect using specific contract ID
     *
     * @param options - Connection options
     * @returns Connection result, or null if no session and not prompting
     *
     * @example
     * ```typescript
     * // Page load - silent restore
     * const result = await kit.connectWallet();
     * if (!result) showConnectButton();
     *
     * // User clicks "Connect Wallet"
     * await kit.connectWallet({ prompt: true });
     *
     * // User clicks "Switch Wallet"
     * await kit.connectWallet({ fresh: true });
     * ```
     */
    connectWallet(options?: {
        /** Use specific credential ID */
        credentialId?: string;
        /** Use specific contract ID */
        contractId?: string;
        /** Ignore stored session, always prompt user */
        fresh?: boolean;
        /** Prompt user if no stored session (default: false) */
        prompt?: boolean;
    }): Promise<ConnectWalletResult | null>;
    /**
     * Internal helper to connect with known credentials
     */
    private connectWithCredentials;
    /**
     * Disconnect from the current wallet and clear stored session
     */
    disconnect(): Promise<void>;
    /**
     * Sign a transaction's auth entries with a passkey.
     *
     * **IMPORTANT**: This method only signs authorization entries. It does NOT
     * re-simulate the transaction. For WebAuthn signatures, you MUST re-simulate
     * before submission because WebAuthn signatures are much larger than the
     * placeholders used during initial simulation.
     *
     * For most use cases, prefer `signAndSubmit()` which handles the full flow:
     * sign → re-simulate → assemble → submit.
     *
     * @param transaction - AssembledTransaction to sign
     * @param options - Signing options
     * @returns The transaction with signed auth entries (NOT ready for direct submission)
     */
    sign<T>(transaction: contract.AssembledTransaction<T>, options?: {
        credentialId?: string;
        expiration?: number;
        resolveContextRuleIds?: (entry: xdr.SorobanAuthorizationEntry, index: number) => number[] | Promise<number[]>;
    }): Promise<contract.AssembledTransaction<T>>;
    /**
     * Sign and submit a transaction with proper re-simulation for WebAuthn.
     *
     * This is the recommended method for submitting transactions signed by the
     * smart account's passkey. It handles the full flow:
     * 1. Sign authorization entries with WebAuthn
     * 2. Re-simulate with signed entries (required for accurate resource costs)
     * 3. Assemble the transaction with correct fees
     * 4. Sign with fee payer and submit
     *
     * @param transaction - AssembledTransaction to sign and submit
     * @param options - Signing options
     * @returns Transaction result
     */
    signAndSubmit<T>(transaction: contract.AssembledTransaction<T>, options?: {
        credentialId?: string;
        expiration?: number;
        resolveContextRuleIds?: (entry: xdr.SorobanAuthorizationEntry, index: number) => number[] | Promise<number[]>;
        /** Force a specific submission method (relayer or rpc) */
        forceMethod?: SubmissionMethod;
    }): Promise<TransactionResult>;
    /**
     * Sign a single authorization entry with a passkey.
     *
     * This is a low-level method useful for multi-signer flows.
     * For most use cases, prefer:
     * - `signAndSubmit()` for full sign + re-simulate + submit flow
     * - `sign()` to sign auth entries on an AssembledTransaction
     * - `multiSigners.operation()` for multi-signer operations
     *
     * @param entry - The authorization entry to sign
     * @param options - Signing options (credentialId, expiration)
     * @returns The signed authorization entry
     */
    signAuthEntry(entry: xdr.SorobanAuthorizationEntry, options?: {
        credentialId?: string;
        expiration?: number;
        contextRuleIds?: number[];
    }): Promise<xdr.SorobanAuthorizationEntry>;
    /**
     * Fund a wallet on testnet using Friendbot
     *
     * Only works on Stellar testnet. Creates a temporary account, funds it
     * via Friendbot, then transfers XLM to the smart account contract.
     * This is necessary because Friendbot can't fund contract addresses directly.
     *
     * @param nativeTokenContract - Native XLM token SAC address (required for transfer)
     * @param options - Optional settings
     * @returns Whether the funding was successful, and the amount funded
     */
    fundWallet(nativeTokenContract: string, options?: {
        /** Force a specific submission method (relayer or rpc) */
        forceMethod?: SubmissionMethod;
    }): Promise<TransactionResult & {
        amount?: number;
    }>;
    /**
     * Transfer tokens from the smart wallet to a recipient
     *
     * This handles the full flow: build transaction, simulate, sign auth entries
     * with passkey, re-simulate for accurate resources, and submit.
     *
     * The deployer keypair is used as the fee payer (transaction source).
     *
     * @param tokenContract - Token contract address (SAC address for native assets)
     * @param recipient - Recipient address (G... or C...)
     * @param amount - Amount to transfer (in token units, e.g., 10 for 10 XLM)
     * @param options - Transfer options
     * @returns Transfer result
     */
    transfer(tokenContract: string, recipient: string, amount: number, options?: {
        /** Credential ID to use for signing (defaults to connected credential) */
        credentialId?: string;
        /** Force a specific submission method (relayer or rpc) */
        forceMethod?: SubmissionMethod;
    }): Promise<TransactionResult>;
    /**
     * Build a smart-account mediated contract call.
     *
     * This wraps the generated `wallet.execute(...)` method and returns the
     * assembled transaction so callers can inspect, sign, or compose around it.
     *
     * For the common "build + sign + submit" flow, prefer `executeAndSubmit()`.
     *
     * @param target - Target contract address
     * @param targetFn - Function name to invoke on the target contract
     * @param targetArgs - Arguments to pass to the target contract function
     * @returns Assembled transaction for the smart-account `execute` call
     */
    execute(target: string, targetFn: string, targetArgs: Array<unknown>): Promise<Awaited<ReturnType<SmartAccountClient["execute"]>>>;
    /**
     * Build, sign, re-simulate, and submit a smart-account mediated contract call.
     *
     * This is the high-level convenience path for arbitrary smart-account
     * executions, equivalent to:
     * 1. `kit.execute(...)`
     * 2. `kit.signAndSubmit(...)`
     *
     * @param target - Target contract address
     * @param targetFn - Function name to invoke on the target contract
     * @param targetArgs - Arguments to pass to the target contract function
     * @param options - Signing and submission options
     * @returns Transaction result
     */
    executeAndSubmit(target: string, targetFn: string, targetArgs: Array<unknown>, options?: {
        credentialId?: string;
        expiration?: number;
        resolveContextRuleIds?: (entry: xdr.SorobanAuthorizationEntry, index: number) => number[] | Promise<number[]>;
        forceMethod?: SubmissionMethod;
    }): Promise<TransactionResult>;
    /**
     * Check if a transaction has any auth entries using source_account credentials.
     *
     * When auth uses source_account credentials, the authorization comes from the
     * transaction envelope signature, so we MUST sign even when using fee sponsoring.
     * For Address credentials, the authorization is in the auth entry itself.
     *
     * @param transaction - The transaction to check
     * @returns true if any auth entry uses source_account credentials
     * @internal
     */
    private hasSourceAccountAuth;
    /**
     * Sign auth entries with WebAuthn, re-simulate, and prepare transaction for submission.
     *
     * This is the core helper that handles the WebAuthn-specific flow:
     * 1. Sign each auth entry with the passkey
     * 2. Rebuild transaction with signed auth
     * 3. Re-simulate to get accurate resource costs (WebAuthn signatures are large)
     * 4. Assemble transaction with correct fees and soroban data
     *
     * @returns Prepared transaction ready for fee payer signature and submission
     */
    private signResimulateAndPrepare;
    private resolveConnectedContextRuleIds;
    /**
     * Check if fee sponsoring service (Relayer) should be used.
     * When using fee sponsoring, transactions are wrapped in a fee-bump, so the
     * envelope signature is generally not required (unless source_account auth is present).
     */
    private shouldUseFeeSponsoring;
    /**
     * Send a transaction and poll for confirmation.
     *
     * Uses the following priority for submission (unless overridden):
     * 1. Relayer (if configured) - submits func + auth entries
     * 2. RPC (direct submission) - submits full transaction XDR
     *
     * @param transaction - The transaction to submit
     * @param options - Submission options
     * @returns Transaction result with hash and status
     */
    private sendAndPoll;
    /**
     * Build a deployment transaction for the smart account contract
     * Returns an AssembledTransaction that can be signed and sent
     */
    private buildDeployTransaction;
    /**
     * Convert policy parameters to ScVal format for on-chain submission.
     *
     * When adding policies via `kit.policies.add()`, the install parameters need
     * to be in ScVal format. This method converts native JavaScript objects to
     * the proper ScVal format based on the policy type.
     *
     * @param policyType - The type of policy: "threshold", "spending_limit", or "weighted_threshold"
     * @param params - The policy parameters as a native JavaScript object
     * @returns The parameters converted to ScVal format, or the original params if conversion fails
     *
     * @example
     * ```typescript
     * // Convert threshold policy params
     * const thresholdParams = kit.convertPolicyParams("threshold", { threshold: 2 });
     *
     * // Convert spending limit params
     * const spendingParams = kit.convertPolicyParams("spending_limit", {
     *   token: "CDLZFC3...",
     *   limit: 1000000000n,
     *   period: 8640, // ~1 day in ledgers
     * });
     *
     * // Use with policies.add()
     * const tx = await kit.policies.add(ruleId, policyAddress, thresholdParams);
     * ```
     */
    convertPolicyParams(policyType: "threshold" | "spending_limit" | "weighted_threshold", params: unknown): unknown;
    /**
     * Build a sorted policies Map as ScVal for on-chain submission.
     *
     * Soroban requires ScMap keys to be sorted. This method converts a JavaScript
     * Map of policy addresses to params into a properly sorted ScVal.
     *
     * @param policies - Map of policy addresses (C...) to their params
     * @param policyTypes - Map of policy addresses to their types (for conversion)
     * @returns ScVal representing the sorted policies map
     */
    buildPoliciesScVal(policies: Map<string, unknown>, policyTypes: Map<string, "threshold" | "spending_limit" | "weighted_threshold" | "custom">): xdr.ScVal;
}
//# sourceMappingURL=kit.d.ts.map