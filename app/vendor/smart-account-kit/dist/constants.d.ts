/**
 * Constants used throughout the Smart Account Kit SDK.
 *
 * @packageDocumentation
 */
/** Default timeout for WebAuthn operations in milliseconds */
export declare const WEBAUTHN_TIMEOUT_MS = 60000;
/** Default base fee for Stellar transactions (in stroops) */
export declare const BASE_FEE = "100";
/** Number of stroops per XLM (1 XLM = 10,000,000 stroops) */
export declare const STROOPS_PER_XLM = 10000000;
/** Reserve XLM amount to keep when funding via Friendbot */
export declare const FRIENDBOT_RESERVE_XLM = 5;
/** Size of an uncompressed secp256r1 (P-256) public key in bytes */
export declare const SECP256R1_PUBLIC_KEY_SIZE = 65;
/** First byte of an uncompressed secp256r1 public key (0x04) */
export declare const UNCOMPRESSED_PUBKEY_PREFIX = 4;
/** Default IndexedDB database name */
export declare const DB_NAME = "smart-account-kit";
/** Current IndexedDB schema version */
export declare const DB_VERSION = 2;
/** LocalStorage key for credentials */
export declare const LOCALSTORAGE_CREDENTIALS_KEY = "smart-account-kit:credentials";
/** LocalStorage key for session */
export declare const LOCALSTORAGE_SESSION_KEY = "smart-account-kit:session";
/** Default session expiration time in milliseconds (7 days) */
export declare const DEFAULT_SESSION_EXPIRY_MS: number;
/** Approximate number of ledgers per hour (~5 seconds per ledger) */
export declare const LEDGERS_PER_HOUR = 720;
/** Approximate number of ledgers per day */
export declare const LEDGERS_PER_DAY = 17280;
/** Approximate number of ledgers per week */
export declare const LEDGERS_PER_WEEK = 120960;
/** Buffer ledgers for auth entry expiration to ensure they don't expire during signing */
export declare const AUTH_ENTRY_EXPIRATION_BUFFER = 100;
/** Stellar Friendbot URL for testnet funding */
export declare const FRIENDBOT_URL = "https://friendbot.stellar.org";
/** Default timeout for indexer requests in milliseconds */
export declare const DEFAULT_INDEXER_TIMEOUT_MS = 10000;
/** Default timeout for relayer requests in milliseconds (6 minutes for testnet retries) */
export declare const DEFAULT_RELAYER_TIMEOUT_MS = 360000;
/** IndexedDB store name for credentials */
export declare const IDB_STORE_CREDENTIALS = "credentials";
/** IndexedDB store name for session data */
export declare const IDB_STORE_SESSION = "session";
/** IndexedDB key for current session */
export declare const IDB_SESSION_KEY = "current";
/** IndexedDB index name for contract ID lookups */
export declare const IDB_INDEX_CONTRACT_ID = "contractId";
/** IndexedDB index name for creation date sorting */
export declare const IDB_INDEX_CREATED_AT = "createdAt";
/** IndexedDB index name for primary credential filtering */
export declare const IDB_INDEX_IS_PRIMARY = "isPrimary";
/** Indexer API path for credential lookup */
export declare const API_PATH_LOOKUP = "/api/lookup";
/** Indexer API path for address lookup */
export declare const API_PATH_LOOKUP_ADDRESS = "/api/lookup/address";
/** Indexer API path for contract details */
export declare const API_PATH_CONTRACT = "/api/contract";
/** Indexer API path for stats */
export declare const API_PATH_STATS = "/api/stats";
//# sourceMappingURL=constants.d.ts.map