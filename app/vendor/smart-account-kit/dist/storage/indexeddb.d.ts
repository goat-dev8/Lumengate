/**
 * IndexedDB Storage Adapter
 *
 * Recommended storage for web applications. Provides:
 * - Larger storage limits than localStorage
 * - Structured data with indexing
 * - Async API that doesn't block the main thread
 * - Better support for binary data (Uint8Array)
 */
import type { StorageAdapter, StoredCredential, StoredSession } from "../types";
export declare class IndexedDBStorage implements StorageAdapter {
    private dbName;
    private dbPromise;
    constructor(dbName?: string);
    private getDB;
    private withStore;
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
    /**
     * Close the database connection
     */
    close(): Promise<void>;
    /**
     * Delete the entire database
     */
    static deleteDatabase(dbName?: string): Promise<void>;
}
//# sourceMappingURL=indexeddb.d.ts.map