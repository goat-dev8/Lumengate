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
export var SmartAccountErrorCode;
(function (SmartAccountErrorCode) {
    // Configuration errors (1xxx)
    SmartAccountErrorCode[SmartAccountErrorCode["INVALID_CONFIG"] = 1001] = "INVALID_CONFIG";
    SmartAccountErrorCode[SmartAccountErrorCode["MISSING_CONFIG"] = 1002] = "MISSING_CONFIG";
    // Wallet state errors (2xxx)
    SmartAccountErrorCode[SmartAccountErrorCode["WALLET_NOT_CONNECTED"] = 2001] = "WALLET_NOT_CONNECTED";
    SmartAccountErrorCode[SmartAccountErrorCode["WALLET_ALREADY_EXISTS"] = 2002] = "WALLET_ALREADY_EXISTS";
    SmartAccountErrorCode[SmartAccountErrorCode["WALLET_NOT_FOUND"] = 2003] = "WALLET_NOT_FOUND";
    // Credential errors (3xxx)
    SmartAccountErrorCode[SmartAccountErrorCode["CREDENTIAL_NOT_FOUND"] = 3001] = "CREDENTIAL_NOT_FOUND";
    SmartAccountErrorCode[SmartAccountErrorCode["CREDENTIAL_ALREADY_EXISTS"] = 3002] = "CREDENTIAL_ALREADY_EXISTS";
    SmartAccountErrorCode[SmartAccountErrorCode["CREDENTIAL_INVALID"] = 3003] = "CREDENTIAL_INVALID";
    SmartAccountErrorCode[SmartAccountErrorCode["CREDENTIAL_DEPLOYMENT_FAILED"] = 3004] = "CREDENTIAL_DEPLOYMENT_FAILED";
    // WebAuthn errors (4xxx)
    SmartAccountErrorCode[SmartAccountErrorCode["WEBAUTHN_REGISTRATION_FAILED"] = 4001] = "WEBAUTHN_REGISTRATION_FAILED";
    SmartAccountErrorCode[SmartAccountErrorCode["WEBAUTHN_AUTHENTICATION_FAILED"] = 4002] = "WEBAUTHN_AUTHENTICATION_FAILED";
    SmartAccountErrorCode[SmartAccountErrorCode["WEBAUTHN_NOT_SUPPORTED"] = 4003] = "WEBAUTHN_NOT_SUPPORTED";
    SmartAccountErrorCode[SmartAccountErrorCode["WEBAUTHN_CANCELLED"] = 4004] = "WEBAUTHN_CANCELLED";
    // Transaction errors (5xxx)
    SmartAccountErrorCode[SmartAccountErrorCode["TRANSACTION_SIMULATION_FAILED"] = 5001] = "TRANSACTION_SIMULATION_FAILED";
    SmartAccountErrorCode[SmartAccountErrorCode["TRANSACTION_SIGNING_FAILED"] = 5002] = "TRANSACTION_SIGNING_FAILED";
    SmartAccountErrorCode[SmartAccountErrorCode["TRANSACTION_SUBMISSION_FAILED"] = 5003] = "TRANSACTION_SUBMISSION_FAILED";
    SmartAccountErrorCode[SmartAccountErrorCode["TRANSACTION_TIMEOUT"] = 5004] = "TRANSACTION_TIMEOUT";
    // Signer errors (6xxx)
    SmartAccountErrorCode[SmartAccountErrorCode["SIGNER_NOT_FOUND"] = 6001] = "SIGNER_NOT_FOUND";
    SmartAccountErrorCode[SmartAccountErrorCode["SIGNER_INVALID"] = 6002] = "SIGNER_INVALID";
    // Validation errors (7xxx)
    SmartAccountErrorCode[SmartAccountErrorCode["INVALID_ADDRESS"] = 7001] = "INVALID_ADDRESS";
    SmartAccountErrorCode[SmartAccountErrorCode["INVALID_AMOUNT"] = 7002] = "INVALID_AMOUNT";
    SmartAccountErrorCode[SmartAccountErrorCode["INVALID_INPUT"] = 7003] = "INVALID_INPUT";
    // Storage errors (8xxx)
    SmartAccountErrorCode[SmartAccountErrorCode["STORAGE_READ_FAILED"] = 8001] = "STORAGE_READ_FAILED";
    SmartAccountErrorCode[SmartAccountErrorCode["STORAGE_WRITE_FAILED"] = 8002] = "STORAGE_WRITE_FAILED";
    // Session errors (9xxx)
    SmartAccountErrorCode[SmartAccountErrorCode["SESSION_EXPIRED"] = 9001] = "SESSION_EXPIRED";
    SmartAccountErrorCode[SmartAccountErrorCode["SESSION_INVALID"] = 9002] = "SESSION_INVALID";
})(SmartAccountErrorCode || (SmartAccountErrorCode = {}));
/**
 * Base error class for all Smart Account Kit errors.
 */
export class SmartAccountError extends Error {
    /** Error code for programmatic error handling */
    code;
    /** Additional context about the error */
    context;
    /** Original error that caused this error */
    cause;
    constructor(message, code, options) {
        super(message);
        this.name = "SmartAccountError";
        this.code = code;
        this.context = options?.context;
        this.cause = options?.cause;
        // Maintain proper stack trace in V8 environments
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, SmartAccountError);
        }
    }
    /**
     * Create a formatted error message with code and context.
     */
    toDetailedString() {
        let msg = `[${this.code}] ${this.message}`;
        if (this.context) {
            msg += `\nContext: ${JSON.stringify(this.context, null, 2)}`;
        }
        if (this.cause) {
            msg += `\nCaused by: ${this.cause.message}`;
        }
        return msg;
    }
}
/**
 * Error thrown when wallet is not connected but operation requires it.
 */
export class WalletNotConnectedError extends SmartAccountError {
    constructor(operation) {
        super(operation
            ? `Wallet must be connected to ${operation}`
            : "Wallet not connected", SmartAccountErrorCode.WALLET_NOT_CONNECTED, { context: operation ? { operation } : undefined });
        this.name = "WalletNotConnectedError";
    }
}
/**
 * Error thrown when a credential cannot be found.
 */
export class CredentialNotFoundError extends SmartAccountError {
    constructor(credentialId) {
        super(`Credential not found: ${credentialId}`, SmartAccountErrorCode.CREDENTIAL_NOT_FOUND, { context: { credentialId } });
        this.name = "CredentialNotFoundError";
    }
}
/**
 * Error thrown when a signer cannot be found.
 */
export class SignerNotFoundError extends SmartAccountError {
    constructor(identifier) {
        super(`No signer found for: ${identifier}`, SmartAccountErrorCode.SIGNER_NOT_FOUND, { context: { identifier } });
        this.name = "SignerNotFoundError";
    }
}
/**
 * Error thrown when transaction simulation fails.
 */
export class SimulationError extends SmartAccountError {
    constructor(message, details) {
        super(message, SmartAccountErrorCode.TRANSACTION_SIMULATION_FAILED, {
            context: details,
        });
        this.name = "SimulationError";
    }
}
/**
 * Error thrown when transaction submission fails.
 */
export class SubmissionError extends SmartAccountError {
    constructor(message, hash, details) {
        super(message, SmartAccountErrorCode.TRANSACTION_SUBMISSION_FAILED, {
            context: { hash, ...details },
        });
        this.name = "SubmissionError";
    }
}
/**
 * Error thrown when input validation fails.
 */
export class ValidationError extends SmartAccountError {
    constructor(message, code = SmartAccountErrorCode.INVALID_INPUT, context) {
        super(message, code, { context });
        this.name = "ValidationError";
    }
}
/**
 * Error thrown when WebAuthn operations fail.
 */
export class WebAuthnError extends SmartAccountError {
    constructor(message, code, cause) {
        super(message, code, { cause });
        this.name = "WebAuthnError";
    }
}
/**
 * Error thrown when session is expired or invalid.
 */
export class SessionError extends SmartAccountError {
    constructor(message, code = SmartAccountErrorCode.SESSION_INVALID) {
        super(message, code);
        this.name = "SessionError";
    }
}
/**
 * Helper to wrap unknown errors in SmartAccountError.
 */
export function wrapError(err, defaultCode = SmartAccountErrorCode.INVALID_INPUT) {
    if (err instanceof SmartAccountError) {
        return err;
    }
    const message = err instanceof Error ? err.message : String(err);
    const cause = err instanceof Error ? err : undefined;
    return new SmartAccountError(message, defaultCode, { cause });
}
//# sourceMappingURL=errors.js.map