/**
 * Event system for Smart Account Kit.
 *
 * Provides a simple event emitter for credential lifecycle events.
 *
 * @packageDocumentation
 */
// ============================================================================
// Event Emitter
// ============================================================================
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
export class SmartAccountEventEmitter {
    listeners = new Map();
    /** Optional error handler for listener errors */
    errorHandler;
    /**
     * Set an error handler for listener errors.
     * By default, listener errors are silently caught.
     *
     * @param handler - Error handler function, or undefined to disable
     */
    setErrorHandler(handler) {
        this.errorHandler = handler;
    }
    /**
     * Subscribe to an event.
     *
     * @param event - The event to subscribe to
     * @param listener - The callback function
     * @returns An unsubscribe function
     */
    on(event, listener) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        const listeners = this.listeners.get(event);
        listeners.add(listener);
        // Return unsubscribe function
        return () => {
            listeners.delete(listener);
        };
    }
    /**
     * Subscribe to an event, but only trigger once.
     *
     * @param event - The event to subscribe to
     * @param listener - The callback function
     * @returns An unsubscribe function
     */
    once(event, listener) {
        const unsubscribe = this.on(event, (data) => {
            unsubscribe();
            listener(data);
        });
        return unsubscribe;
    }
    /**
     * Unsubscribe from an event.
     *
     * @param event - The event to unsubscribe from
     * @param listener - The callback function to remove
     */
    off(event, listener) {
        const listeners = this.listeners.get(event);
        if (listeners) {
            listeners.delete(listener);
        }
    }
    /**
     * Emit an event to all subscribers.
     *
     * Listener errors are caught to prevent one failing listener from
     * affecting others. If you need error handling, wrap your listener.
     *
     * @param event - The event to emit
     * @param data - The event data
     */
    emit(event, data) {
        const listeners = this.listeners.get(event);
        if (listeners) {
            for (const listener of listeners) {
                try {
                    listener(data);
                }
                catch (err) {
                    // Call error handler if provided, otherwise silently catch
                    // to prevent one failing listener from affecting others
                    if (this.errorHandler) {
                        this.errorHandler(event, err);
                    }
                }
            }
        }
    }
    /**
     * Remove all listeners for a specific event, or all events if no event is specified.
     *
     * @param event - Optional event to clear listeners for
     */
    removeAllListeners(event) {
        if (event) {
            this.listeners.delete(event);
        }
        else {
            this.listeners.clear();
        }
    }
    /**
     * Get the number of listeners for an event.
     *
     * @param event - The event to check
     * @returns The number of listeners
     */
    listenerCount(event) {
        return this.listeners.get(event)?.size ?? 0;
    }
}
//# sourceMappingURL=events.js.map