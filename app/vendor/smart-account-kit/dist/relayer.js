/**
 * Relayer Client
 *
 * Client for submitting transactions via a Relayer proxy service.
 * The proxy handles communication with OpenZeppelin Relayer Channels,
 * managing API keys and providing CORS support for browser clients.
 *
 * Two submission modes:
 * 1. `send(func, auth)` - For Address credentials. Relayer builds the tx envelope.
 * 2. `sendXdr(xdr)` - For signed transactions. Relayer fee-bumps the signed tx.
 *
 * @see https://docs.openzeppelin.com/relayer/1.3.x/plugins/channels
 */
import { NAME, VERSION } from "./version";
import { DEFAULT_RELAYER_TIMEOUT_MS } from "./constants";
/**
 * Error codes from Relayer service
 */
export const RelayerErrorCodes = {
    INVALID_PARAMS: "INVALID_PARAMS",
    INVALID_XDR: "INVALID_XDR",
    POOL_CAPACITY: "POOL_CAPACITY",
    SIMULATION_FAILED: "SIMULATION_FAILED",
    ONCHAIN_FAILED: "ONCHAIN_FAILED",
    INVALID_TIME_BOUNDS: "INVALID_TIME_BOUNDS",
    FEE_LIMIT_EXCEEDED: "FEE_LIMIT_EXCEEDED",
    UNAUTHORIZED: "UNAUTHORIZED",
};
/**
 * Relayer client for fee-sponsored transaction submission via proxy.
 *
 * POSTs func + auth entries to the configured URL. The proxy handles
 * communication with OpenZeppelin Relayer Channels, managing API keys and CORS.
 *
 * @example
 * ```typescript
 * const relayer = new RelayerClient(
 *   'https://my-relayer-proxy.example.com'
 * );
 *
 * // Submit a transaction with func and auth entries
 * const result = await relayer.send(funcXdr, authXdrArray);
 * if (result.success) {
 *   console.log('Transaction hash:', result.hash);
 * }
 * ```
 */
export class RelayerClient {
    url;
    timeout;
    // Default timeout of 6 minutes to accommodate testnet retries (up to 5 min)
    // when Relayer channel accounts need funding after testnet reset.
    // Mainnet requests return quickly; this only affects max wait time.
    constructor(url, timeout = DEFAULT_RELAYER_TIMEOUT_MS) {
        if (!url) {
            throw new Error("Relayer URL is required");
        }
        this.url = url.replace(/\/+$/, "");
        this.timeout = timeout;
    }
    /**
     * Check if the client is properly configured
     */
    get isConfigured() {
        return !!this.url;
    }
    asObject(value) {
        if (!value || typeof value !== "object") {
            return null;
        }
        return value;
    }
    looksLikeErrorCode(value) {
        return /^[A-Z][A-Z0-9_:-]*$/.test(value.trim());
    }
    extractResponseData(responseData) {
        const root = this.asObject(responseData);
        if (!root) {
            return {};
        }
        const nested = this.asObject(root.data);
        return nested ?? root;
    }
    hasTransactionFields(value) {
        const data = this.asObject(value);
        if (!data) {
            return false;
        }
        return (typeof data.transactionId === "string" ||
            typeof data.hash === "string" ||
            typeof data.status === "string");
    }
    isSuccessResponse(response, responseData) {
        const root = this.asObject(responseData);
        if (!root) {
            return false;
        }
        if (root.success === true) {
            return true;
        }
        if (!response.ok || root.success === false) {
            return false;
        }
        // Backward compatibility: some relayer proxies return tx fields directly
        // without a top-level `success` boolean.
        if (this.hasTransactionFields(root)) {
            return true;
        }
        const nested = this.asObject(root.data);
        return this.hasTransactionFields(nested);
    }
    extractErrorMessage(responseData, status) {
        const root = this.asObject(responseData);
        if (!root) {
            return `Relayer request failed with status ${status}`;
        }
        const message = typeof root.message === "string" ? root.message.trim() : "";
        if (message.length > 0) {
            return message;
        }
        const rawError = typeof root.error === "string" ? root.error.trim() : "";
        if (rawError.length > 0 && !this.looksLikeErrorCode(rawError)) {
            return rawError;
        }
        const nested = this.asObject(root.data);
        const nestedMessage = nested && typeof nested.message === "string"
            ? nested.message.trim()
            : "";
        if (nestedMessage.length > 0) {
            return nestedMessage;
        }
        if (rawError.length > 0) {
            return rawError;
        }
        return `Relayer request failed with status ${status}`;
    }
    toSuccessResult(responseData) {
        const data = this.extractResponseData(responseData);
        return {
            success: true,
            transactionId: typeof data.transactionId === "string" ? data.transactionId : undefined,
            hash: typeof data.hash === "string" ? data.hash : undefined,
            status: typeof data.status === "string" ? data.status : undefined,
        };
    }
    toErrorResult(responseData, status) {
        const errorCode = this.extractErrorCode(responseData);
        return {
            success: false,
            error: this.extractErrorMessage(responseData, status),
            errorCode,
            details: this.extractResponseData(responseData),
        };
    }
    async submit(body, options) {
        const headers = {
            "Content-Type": "application/json",
            "X-Client-Name": NAME,
            "X-Client-Version": VERSION,
        };
        try {
            const controller = new AbortController();
            const timeout = options?.timeout ?? this.timeout;
            const timeoutId = setTimeout(() => controller.abort(), timeout);
            const response = await fetch(this.url, {
                method: "POST",
                headers,
                body,
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            let responseData = null;
            try {
                responseData = await response.json();
            }
            catch {
                responseData = null;
            }
            if (this.isSuccessResponse(response, responseData)) {
                return this.toSuccessResult(responseData);
            }
            return this.toErrorResult(responseData, response.status);
        }
        catch (err) {
            if (err instanceof Error && err.name === "AbortError") {
                return {
                    success: false,
                    error: "Relayer request timed out",
                    errorCode: "TIMEOUT",
                };
            }
            return {
                success: false,
                error: err instanceof Error ? err.message : "Relayer request failed",
                details: err,
            };
        }
    }
    /**
     * Submit a transaction via Relayer for fee sponsoring.
     *
     * The Relayer builds the transaction envelope using channel accounts and pays the fees.
     * Transactions are submitted in parallel using a pool of channel accounts.
     *
     * @param func - Base64 encoded Soroban host function XDR
     * @param auth - Array of base64 encoded authorization entry XDRs
     * @param options - Optional submission options
     * @returns The submission result
     *
     * @example
     * ```typescript
     * // Extract func and auth from a prepared transaction
     * const funcXdr = hostFunc.toXDR('base64');
     * const authXdrs = authEntries.map(e => e.toXDR('base64'));
     *
     * const result = await relayer.send(funcXdr, authXdrs);
     *
     * if (result.success) {
     *   console.log('Hash:', result.hash);
     * } else {
     *   console.error('Error:', result.error, result.errorCode);
     * }
     * ```
     */
    async send(func, auth, options) {
        return this.submit(JSON.stringify({ func, auth }), options);
    }
    /**
     * Submit a signed transaction for fee-bumping.
     *
     * Use this for transactions that require source_account auth (e.g., deployment).
     * The Relayer will fee-bump the signed transaction, preserving the inner signature.
     *
     * @param transaction - Signed transaction (Transaction object or XDR string)
     * @param options - Optional submission options
     * @returns The submission result
     *
     * @example
     * ```typescript
     * // Sign the deployment transaction
     * deployTx.sign(deployerKeypair);
     *
     * // Submit for fee-bumping
     * const result = await relayer.sendXdr(deployTx);
     * ```
     */
    async sendXdr(transaction, options) {
        // Convert to XDR string
        const xdr = typeof transaction === "string"
            ? transaction
            : transaction.toXDR();
        return this.submit(JSON.stringify({ xdr }), options);
    }
    /**
     * Extract error code from Relayer response
     */
    extractErrorCode(responseData) {
        const data = this.asObject(responseData);
        if (!data) {
            return undefined;
        }
        // Check common error code locations
        if (typeof data.code === "string") {
            return data.code;
        }
        if (typeof data.errorCode === "string") {
            return data.errorCode;
        }
        if (data.data && typeof data.data === "object") {
            const nestedData = data.data;
            if (typeof nestedData.code === "string") {
                return nestedData.code;
            }
            if (typeof nestedData.errorCode === "string") {
                return nestedData.errorCode;
            }
            if (typeof nestedData.error === "string" && this.looksLikeErrorCode(nestedData.error)) {
                return nestedData.error;
            }
        }
        if (typeof data.error === "string" && this.looksLikeErrorCode(data.error)) {
            return data.error;
        }
        return undefined;
    }
}
//# sourceMappingURL=relayer.js.map