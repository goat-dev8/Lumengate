/**
 * Smart Account Kit
 *
 * TypeScript SDK for deploying and managing OpenZeppelin Smart Account contracts
 * on Stellar/Soroban with WebAuthn passkey authentication.
 *
 * @packageDocumentation
 */
export { SmartAccountKit } from "./kit";
export type { SignerManager, ContextRuleManager, PolicyManager, CredentialManager, MultiSignerManager, MultiSignerOptions, } from "./kit";
export { ExternalSignerManager, type ExternalSigner, type WalletStorage, } from "./external-signers";
export type { SmartAccountConfig, PolicyConfig, StoredCredential, StoredSession, CredentialDeploymentStatus, StorageAdapter, CreateWalletResult, ConnectWalletResult, TransactionResult, SubmissionOptions, SubmissionMethod, ExternalWalletAdapter, ConnectedWallet, SelectedSigner, } from "./types";
export type { Signer as ContractSigner, ContextRule, ContextRuleType, AuthPayload, } from "smart-account-kit-bindings";
export type { WebAuthnSigData, SimpleThresholdAccountParams, WeightedThresholdAccountParams, SpendingLimitAccountParams, } from "./contract-types";
export { MemoryStorage, LocalStorageAdapter, IndexedDBStorage, } from "./storage";
export { WEBAUTHN_TIMEOUT_MS, BASE_FEE, STROOPS_PER_XLM, FRIENDBOT_RESERVE_XLM, } from "./constants";
export { SmartAccountError, SmartAccountErrorCode, WalletNotConnectedError, CredentialNotFoundError, SignerNotFoundError, SimulationError, SubmissionError, ValidationError, WebAuthnError, SessionError, wrapError, } from "./errors";
export { xlmToStroops, stroopsToXlm, validateAddress, validateAmount, validateNotEmpty, generateChallenge, } from "./utils";
export { createDelegatedSigner, createExternalSigner, createWebAuthnSigner, createEd25519Signer, createDefaultContext, createCallContractContext, createCreateContractContext, createThresholdParams, createWeightedThresholdParams, createSpendingLimitParams, LEDGERS_PER_HOUR, LEDGERS_PER_DAY, LEDGERS_PER_WEEK, truncateAddress, describeSignerType, signerMatchesCredential, signerMatchesAddress, formatSignerForDisplay, formatContextType, } from "./builders";
export { getCredentialIdFromSigner, signersEqual, getSignerKey, collectUniqueSigners, } from "./signer-utils";
export { SmartAccountEventEmitter } from "./events";
export type { SmartAccountEventMap, SmartAccountEvent, EventListener, } from "./events";
export { IndexerClient, IndexerError, DEFAULT_INDEXER_URLS, } from "./indexer";
export type { IndexerConfig, IndexedContractSummary, IndexedSigner, IndexedPolicy, IndexedContextRule, CredentialLookupResponse, AddressLookupResponse, ContractDetailsResponse, IndexerStatsResponse, } from "./indexer";
export { RelayerClient, RelayerErrorCodes } from "./relayer";
export type { RelayerResponse, RelayerSendOptions, RelayerErrorCode, } from "./relayer";
export { StellarWalletsKitAdapter } from "./wallet-adapter";
export type { StellarWalletsKitAdapterConfig } from "./wallet-adapter";
export type { AssembledTransaction } from "@stellar/stellar-sdk/contract";
//# sourceMappingURL=index.d.ts.map