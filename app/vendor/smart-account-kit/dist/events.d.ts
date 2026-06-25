/**
 * Event system for Smart Account Kit.
 *
 * Provides a simple event emitter for credential lifecycle events.
 *
 * @packageDocumentation
 */
import type { StoredCredential } from "./types";
/**
 * All possible Smart Account Kit events.
 */
export type SmartAccountEventMap = {
    /** Emitted when a wallet is connected */
    walletConnected: {
        contractId: string;
        credentialId: string;
    };
    /** Emitted when a wallet is disconnected */
    walletDisconnected: {
        contractId: string;
    };
    /** Emitted when a credential is created (passkey registered) */
    credentialCreated: {
        credential: StoredCredential;
    };
    /** Emitted when a credential is deleted from storage */
    credentialDeleted: {
        credentialId: string;
    };
    /** Emitted when a session expires during connection attempt */
    sessionExpired: {
        contractId: string;
        credentialId: string;
    };
    /** Emitted when a transaction is signed */
    transactionSigned: {
        contractId: string;
        credentialId?: string;
    };
    /** Emitted when a transaction is submitted */
    transactionSubmitted: {
        hash: string;
        success: boolean;
    };
};
/**
 * Event names for the Smart Account Kit.
 */
export type SmartAccountEvent = keyof SmartAccountEventMap;
/**
 * Event listener function type.
 */
export type EventListener<T> = (data: T) => void;
/**
 * Simple event emitter for Smart Account Kit events.
 *
 * @example
 * ```typescript
 * const emitter = new SmartAccountEventEmitter();
 *
 * // Subscribe to events
 * emitter.on('walletConnected', ({ contractId }) => {
 *   console.log('Connected to wallet:', contractId);
 * });
 *
 * // Emit an event
 * emitter.emit('walletConnected', { contractId: 'C...', credentialId: '...' });
 * ```
 */
export declare class SmartAccountEventEmitter {
    private listeners;
    /** Optional error handler for listener errors */
    private errorHandler?;
    /**
     * Set an error handler for listener errors.
     * By default, listener errors are silently caught.
     *
     * @param handler - Error handler function, or undefined to disable
     */
    setErrorHandler(handler: ((event: SmartAccountEvent, error: unknown) => void) | undefined): void;
    /**
     * Subscribe to an event.
     *
     * @param event - The event to subscribe to
     * @param listener - The callback function
     * @returns An unsubscribe function
     */
    on<E extends SmartAccountEvent>(event: E, listener: EventListener<SmartAccountEventMap[E]>): () => void;
    /**
     * Subscribe to an event, but only trigger once.
     *
     * @param event - The event to subscribe to
     * @param listener - The callback function
     * @returns An unsubscribe function
     */
    once<E extends SmartAccountEvent>(event: E, listener: EventListener<SmartAccountEventMap[E]>): () => void;
    /**
     * Unsubscribe from an event.
     *
     * @param event - The event to unsubscribe from
     * @param listener - The callback function to remove
     */
    off<E extends SmartAccountEvent>(event: E, listener: EventListener<SmartAccountEventMap[E]>): void;
    /**
     * Emit an event to all subscribers.
     *
     * Listener errors are caught to prevent one failing listener from
     * affecting others. If you need error handling, wrap your listener.
     *
     * @param event - The event to emit
     * @param data - The event data
     */
    emit<E extends SmartAccountEvent>(event: E, data: SmartAccountEventMap[E]): void;
    /**
     * Remove all listeners for a specific event, or all events if no event is specified.
     *
     * @param event - Optional event to clear listeners for
     */
    removeAllListeners(event?: SmartAccountEvent): void;
    /**
     * Get the number of listeners for an event.
     *
     * @param event - The event to check
     * @returns The number of listeners
     */
    listenerCount(event: SmartAccountEvent): number;
}
//# sourceMappingURL=events.d.ts.map