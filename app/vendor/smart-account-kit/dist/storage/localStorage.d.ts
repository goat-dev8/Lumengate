/**
 * localStorage Storage Adapter
 *
 * Simple localStorage-based storage for credentials. Works in browsers
 * and provides persistence across page reloads.
 *
 * Note: localStorage has a 5MB limit and data is not encrypted.
 * For production use, consider IndexedDB or server-side storage.
 */
import type { StorageAdapter, StoredCredential, StoredSession } from "../types";
export declare class LocalStorageAdapter implements StorageAdapter {
    private storageKey;
    constructor(storageKey?: string);
    private getStorage;
    private setStorage;
    save(credential: StoredCredential): Promise<void>;
    get(credentialId: string): Promise<StoredCredential | null>;
    getByContract(contractId: string): Promise<StoredCredential[]>;
    getAll(): Promise<StoredCredential[]>;
    delete(credentialId: string): Promise<void>;
    update(credentialId: string, updates: Partial<Omit<StoredCredential, "credentialId" | "publicKey">>): Promise<void>;
    clear(): Promise<void>;
    saveSession(session: StoredSession): Promise<void>;
    getSession(): Promise<StoredSession | null>;
    clearSession(): Promise<void>;
}
//# sourceMappingURL=localStorage.d.ts.map