/**
 * External Signer Manager
 *
 * Manages G-address signers (Stellar accounts) for multi-signature operations.
 * Supports two methods of adding signers:
 * 1. Raw secret key (Keypair) - stored in memory only
 * 2. External wallet via StellarWalletsKit (if installed)
 *
 * Wallet connections can be persisted to storage and auto-restored on init.
 *
 * @packageDocumentation
 */
import type { ConnectedWallet, ExternalWalletAdapter } from "./types";
/**
 * Simple storage interface for wallet connections
 * Compatible with localStorage, sessionStorage, or custom implementations
 */
export interface WalletStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}
/**
 * Represents an external signer (G-address)
 */
export interface ExternalSigner {
    /** Stellar G-address */
    address: string;
    /** How this signer was added */
    type: "keypair" | "wallet";
    /** Wallet name (for wallet-based signers) */
    walletName?: string;
    /** Wallet ID (for wallet-based signers) */
    walletId?: string;
}
/**
 * Manages external (G-address) signers for the SDK.
 *
 * This class provides a unified interface for managing Stellar account signers,
 * whether they come from raw secret keys or external wallet connections.
 *
 * @example
 * ```typescript
 * // Add from raw secret key (memory-only)
 * const { address } = kit.externalSigners.addFromSecret("S...");
 *
 * // Add from external wallet (if SWK installed)
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
export declare class ExternalSignerManager {
    /** Keypair-based signers (memory-only, never persisted) */
    private keypairSigners;
    /** External wallet adapter (optional, for SWK integration) */
    private walletAdapter;
    /** Network passphrase for signing */
    private networkPassphrase;
    /** Storage for persisting wallet connections (optional) */
    private storage;
    /** Whether connections have been restored */
    private restored;
    constructor(networkPassphrase: string, walletAdapter?: ExternalWalletAdapter, storage?: WalletStorage);
    /**
     * Add a signer from a raw secret key.
     *
     * The keypair is stored in memory only and is never persisted.
     * It will be lost when the page is refreshed.
     *
     * @param secretKey - Stellar secret key (S...)
     * @returns The derived public address
     * @throws Error if the secret key is invalid
     *
     * @example
     * ```typescript
     * const { address } = kit.externalSigners.addFromSecret("SCZANGBA5YHTNYVVV3C7CAZMTQDBJHJG6C34REYB6WBMG7CKKFJHYAEGQ");
     * console.log(`Added signer: ${address}`);
     * ```
     */
    addFromSecret(secretKey: string): {
        address: string;
    };
    /**
     * Add a signer from an external wallet (Freighter, Lobstr, etc.)
     *
     * Requires StellarWalletsKit to be installed and the adapter to be initialized.
     * Shows the wallet selection modal and tracks the connected wallet.
     * If storage is configured, the connection is persisted for auto-restore.
     *
     * @returns Connected wallet info, or null if cancelled/unavailable
     * @throws Error if no wallet adapter is configured
     *
     * @example
     * ```typescript
     * const wallet = await kit.externalSigners.addFromWallet();
     * if (wallet) {
     *   console.log(`Connected: ${wallet.walletName} (${wallet.address})`);
     * }
     * ```
     */
    addFromWallet(): Promise<ConnectedWallet | null>;
    /**
     * Restore previously connected wallets from storage.
     *
     * Attempts to reconnect to all wallets that were saved in storage.
     * This is called automatically if storage is configured, but can also
     * be called manually.
     *
     * @returns Array of successfully restored wallet connections
     *
     * @example
     * ```typescript
     * const restored = await kit.externalSigners.restoreConnections();
     * console.log(`Restored ${restored.length} wallet connections`);
     * ```
     */
    restoreConnections(): Promise<ConnectedWallet[]>;
    /**
     * Remove a signer by address.
     *
     * For keypair signers, this removes the keypair from memory.
     * For wallet signers, this disconnects the wallet and removes from storage.
     *
     * @param address - The G-address to remove
     */
    remove(address: string): void;
    /**
     * Get stored wallet connections from storage
     */
    private getStoredWallets;
    /**
     * Save a wallet connection to storage
     */
    private saveWalletToStorage;
    /**
     * Remove a wallet connection from storage
     */
    private removeWalletFromStorage;
    /**
     * Remove all signers.
     *
     * Clears all keypair signers from memory and disconnects all wallets.
     */
    removeAll(): Promise<void>;
    /**
     * Get all registered external signers.
     *
     * @returns Array of external signer info
     */
    getAll(): ExternalSigner[];
    /**
     * Check if we can sign for a specific address.
     *
     * @param address - The G-address to check
     * @returns True if we have a keypair or connected wallet for this address
     */
    canSignFor(address: string): boolean;
    /**
     * Check if any external signers are registered.
     */
    get hasSigners(): boolean;
    /**
     * Sign an auth entry preimage with an external signer.
     *
     * For keypair signers, signs directly with the Keypair.
     * For wallet signers, delegates to the wallet adapter.
     *
     * @param preimageXdr - Base64-encoded HashIdPreimage XDR
     * @param address - The G-address to sign with
     * @returns Base64-encoded signature
     * @throws Error if no signer is available for the address
     *
     * @internal Used by the SDK during multi-signer operations
     */
    signAuthEntry(preimageXdr: string, address: string): Promise<{
        signedAuthEntry: string;
        signerAddress: string;
    }>;
}
//# sourceMappingURL=external-signers.d.ts.map