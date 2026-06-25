/**
 * Smart Account Kit
 *
 * TypeScript SDK for deploying and managing OpenZeppelin Smart Account contracts
 * on Stellar/Soroban with WebAuthn passkey authentication.
 *
 * @packageDocumentation
 */
// Main client SDK
export { SmartAccountKit } from "./kit";
// External signer types
export { ExternalSignerManager, } from "./external-signers";
// Storage adapters
export { MemoryStorage, LocalStorageAdapter, IndexedDBStorage, } from "./storage";
// Constants (public API - implementation details are internal)
export { 
// Useful timing constants
WEBAUTHN_TIMEOUT_MS, 
// Transaction/funding constants
BASE_FEE, STROOPS_PER_XLM, FRIENDBOT_RESERVE_XLM, } from "./constants";
// Error classes
export { SmartAccountError, SmartAccountErrorCode, WalletNotConnectedError, CredentialNotFoundError, SignerNotFoundError, SimulationError, SubmissionError, ValidationError, WebAuthnError, SessionError, wrapError, } from "./errors";
// Utility functions
export { xlmToStroops, stroopsToXlm, validateAddress, validateAmount, validateNotEmpty, generateChallenge, } from "./utils";
// Builder utilities
export { 
// Signer builders
createDelegatedSigner, createExternalSigner, createWebAuthnSigner, createEd25519Signer, 
// Context rule type builders
createDefaultContext, createCallContractContext, createCreateContractContext, 
// Policy parameter builders
createThresholdParams, createWeightedThresholdParams, createSpendingLimitParams, 
// Time period constants (for spending limits)
LEDGERS_PER_HOUR, LEDGERS_PER_DAY, LEDGERS_PER_WEEK, 
// Compatibility helpers
truncateAddress, describeSignerType, signerMatchesCredential, signerMatchesAddress, formatSignerForDisplay, formatContextType, } from "./builders";
export { getCredentialIdFromSigner, signersEqual, getSignerKey, collectUniqueSigners, } from "./signer-utils";
// Event emitter
export { SmartAccountEventEmitter } from "./events";
// Indexer client for reverse lookups
export { IndexerClient, IndexerError, DEFAULT_INDEXER_URLS, } from "./indexer";
// Relayer client for fee-sponsored transactions via proxy
export { RelayerClient, RelayerErrorCodes } from "./relayer";
// Wallet Adapters
export { StellarWalletsKitAdapter } from "./wallet-adapter";
//# sourceMappingURL=index.js.map