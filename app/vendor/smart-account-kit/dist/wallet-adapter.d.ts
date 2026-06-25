/**
 * External Wallet Adapter Implementations
 *
 * This module provides concrete adapter implementations for integrating
 * external Stellar wallets with the Smart Account Kit.
 *
 * @remarks
 * To use the StellarWalletsKitAdapter, you must install the peer dependency:
 * ```bash
 * pnpm add @creit-tech/stellar-wallets-kit
 * ```
 */
import type { ExternalWalletAdapter, ConnectedWallet } from "./types";
import type { Networks } from "@stellar/stellar-sdk";
import type { ISupportedWallet } from "@creit-tech/stellar-wallets-kit";
/**
 * Configuration options for StellarWalletsKitAdapter
 */
export interface StellarWalletsKitAdapterConfig {
    /**
     * Network to use (e.g., Networks.TESTNET, Networks.PUBLIC)
     * @default Networks.TESTNET
     */
    network?: Networks | string;
    /**
     * Optional callback when connection status changes
     */
    onConnectionChange?: (connected: boolean, wallet?: ConnectedWallet) => void;
}
/**
 * Adapter for StellarWalletsKit
 *
 * This adapter integrates the @creit-tech/stellar-wallets-kit library
 * with the Smart Account Kit, providing a unified interface for
 * connecting to and signing with external Stellar wallets like
 * Freighter, Lobstr, xBull, and others.
 *
 * @remarks
 * Requires `@creit-tech/stellar-wallets-kit` to be installed as a peer dependency.
 *
 * @example
 * ```typescript
 * import { StellarWalletsKitAdapter, SmartAccountKit } from "smart-account-kit";
 * import { Networks } from "@stellar/stellar-sdk";
 *
 * // Create and initialize the adapter
 * const walletAdapter = new StellarWalletsKitAdapter({
 *   network: Networks.TESTNET
 * });
 * await walletAdapter.init();
 *
 * // Use with SmartAccountKit
 * const kit = new SmartAccountKit({
 *   rpcUrl: "https://soroban-testnet.stellar.org",
 *   networkPassphrase: Networks.TESTNET,
 *   externalWallet: walletAdapter,
 * });
 *
 * // Connect a wallet
 * const wallet = await walletAdapter.connect();
 * if (wallet) {
 *   console.log(`Connected: ${wallet.walletName} (${wallet.address})`);
 * }
 * ```
 */
export declare class StellarWalletsKitAdapter implements ExternalWalletAdapter {
    private network;
    private connectedWallets;
    private onConnectionChange?;
    private StellarWalletsKit;
    private initialized;
    constructor(config?: StellarWalletsKitAdapterConfig);
    /**
     * Initialize the adapter
     *
     * Must be called before using connect() or signAuthEntry().
     * This method imports StellarWalletsKit and initializes it with
     * all SEP-43 compatible wallet modules.
     *
     * @throws Error if @creit-tech/stellar-wallets-kit is not installed
     */
    init(): Promise<void>;
    /**
     * Ensure the adapter is initialized and return the StellarWalletsKit instance
     * @internal
     */
    private ensureInitialized;
    /**
     * Get list of available/installed wallet extensions
     *
     * @returns Array of wallet info with availability status
     */
    getAvailableWallets(): Promise<ISupportedWallet[]>;
    /**
     * Connect to a wallet using the built-in modal
     *
     * Shows a modal allowing the user to select and connect their preferred wallet.
     * The connected wallet is tracked internally for signing operations.
     *
     * @returns Connected wallet info, or null if user cancelled
     */
    connect(): Promise<ConnectedWallet | null>;
    /**
     * Reconnect to a previously connected wallet by ID
     *
     * Attempts to reconnect to a specific wallet type without showing the modal.
     * This is used for restoring connections on page reload.
     *
     * If the wallet extension remembers the site authorization, this will
     * succeed silently. Otherwise, it may prompt the user for authorization.
     *
     * @param walletId - The wallet ID to reconnect to (e.g., 'freighter', 'lobstr')
     * @returns Connected wallet info, or null if reconnection failed
     */
    reconnect(walletId: string): Promise<ConnectedWallet | null>;
    /**
     * Disconnect all wallets
     */
    disconnect(): Promise<void>;
    /**
     * Disconnect a specific wallet by address
     *
     * @param address - The Stellar address to disconnect
     */
    disconnectByAddress(address: string): void;
    /**
     * Sign an auth entry with the wallet
     *
     * @param authEntryXdr - The auth entry to sign, as XDR string
     * @param opts - Optional signing options
     * @returns The signed auth entry
     * @throws Error if no wallet is connected or requested address not found
     */
    signAuthEntry(authEntryXdr: string, opts?: {
        networkPassphrase?: string;
        address?: string;
    }): Promise<{
        signedAuthEntry: string;
        signerAddress?: string;
    }>;
    /**
     * Check if we can sign for a specific address
     *
     * @param address - The Stellar address to check
     * @returns True if a wallet is connected for this address
     */
    canSignFor(address: string): boolean;
    /**
     * Get wallet info for a specific address
     *
     * @param address - The Stellar address to look up
     * @returns Wallet info if connected, undefined otherwise
     */
    getWalletForAddress(address: string): ConnectedWallet | undefined;
    /**
     * Get all connected wallets
     *
     * @returns Array of connected wallet info
     */
    getConnectedWallets(): ConnectedWallet[];
    /**
     * Check if any wallet is connected
     */
    get isConnected(): boolean;
}
//# sourceMappingURL=wallet-adapter.d.ts.map