/**
 * Custom error classes for the Smart Account Kit SDK.
 *
 * These provide structured error handling with error codes and context.
 *
 * @packageDocumentation
 */
/**
 * Error codes for Smart Account Kit operations.
 */
export declare enum SmartAccountErrorCode {
    INVALID_CONFIG = 1001,
    MISSING_CONFIG = 1002,
    WALLET_NOT_CONNECTED = 2001,
    WALLET_ALREADY_EXISTS = 2002,
    WALLET_NOT_FOUND = 2003,
    CREDENTIAL_NOT_FOUND = 3001,
    CREDENTIAL_ALREADY_EXISTS = 3002,
    CREDENTIAL_INVALID = 3003,
    CREDENTIAL_DEPLOYMENT_FAILED = 3004,
    WEBAUTHN_REGISTRATION_FAILED = 4001,
    WEBAUTHN_AUTHENTICATION_FAILED = 4002,
    WEBAUTHN_NOT_SUPPORTED = 4003,
    WEBAUTHN_CANCELLED = 4004,
    TRANSACTION_SIMULATION_FAILED = 5001,
    TRANSACTION_SIGNING_FAILED = 5002,
    TRANSACTION_SUBMISSION_FAILED = 5003,
    TRANSACTION_TIMEOUT = 5004,
    SIGNER_NOT_FOUND = 6001,
    SIGNER_INVALID = 6002,
    INVALID_ADDRESS = 7001,
    INVALID_AMOUNT = 7002,
    INVALID_INPUT = 7003,
    STORAGE_READ_FAILED = 8001,
    STORAGE_WRITE_FAILED = 8002,
    SESSION_EXPIRED = 9001,
    SESSION_INVALID = 9002
}
/**
 * Base error class for all Smart Account Kit errors.
 */
export declare class SmartAccountError extends Error {
    /** Error code for programmatic error handling */
    readonly code: SmartAccountErrorCode;
    /** Additional context about the error */
    readonly context?: Record<string, unknown>;
    /** Original error that caused this error */
    readonly cause?: Error;
    constructor(message: string, code: SmartAccountErrorCode, options?: {
        context?: Record<string, unknown>;
        cause?: Error;
    });
    /**
     * Create a formatted error message with code and context.
     */
    toDetailedString(): string;
}
/**
 * Error thrown when wallet is not connected but operation requires it.
 */
export declare class WalletNotConnectedError extends SmartAccountError {
    constructor(operation?: string);
}
/**
 * Error thrown when a credential cannot be found.
 */
export declare class CredentialNotFoundError extends SmartAccountError {
    constructor(credentialId: string);
}
/**
 * Error thrown when a signer cannot be found.
 */
export declare class SignerNotFoundError extends SmartAccountError {
    constructor(identifier: string);
}
/**
 * Error thrown when transaction simulation fails.
 */
export declare class SimulationError extends SmartAccountError {
    constructor(message: string, details?: Record<string, unknown>);
}
/**
 * Error thrown when transaction submission fails.
 */
export declare class SubmissionError extends SmartAccountError {
    constructor(message: string, hash?: string, details?: Record<string, unknown>);
}
/**
 * Error thrown when input validation fails.
 */
export declare class ValidationError extends SmartAccountError {
    constructor(message: string, code?: SmartAccountErrorCode.INVALID_ADDRESS | SmartAccountErrorCode.INVALID_AMOUNT | SmartAccountErrorCode.INVALID_INPUT, context?: Record<string, unknown>);
}
/**
 * Error thrown when WebAuthn operations fail.
 */
export declare class WebAuthnError extends SmartAccountError {
    constructor(message: string, code: SmartAccountErrorCode.WEBAUTHN_REGISTRATION_FAILED | SmartAccountErrorCode.WEBAUTHN_AUTHENTICATION_FAILED | SmartAccountErrorCode.WEBAUTHN_NOT_SUPPORTED | SmartAccountErrorCode.WEBAUTHN_CANCELLED, cause?: Error);
}
/**
 * Error thrown when session is expired or invalid.
 */
export declare class SessionError extends SmartAccountError {
    constructor(message: string, code?: SmartAccountErrorCode.SESSION_EXPIRED | SmartAccountErrorCode.SESSION_INVALID);
}
/**
 * Helper to wrap unknown errors in SmartAccountError.
 */
export declare function wrapError(err: unknown, defaultCode?: SmartAccountErrorCode): SmartAccountError;
//# sourceMappingURL=errors.d.ts.map