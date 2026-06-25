/**
 * In-Memory Storage Adapter
 *
 * Simple in-memory storage for credentials. Useful for testing or
 * server-side environments where persistence isn't needed.
 *
 * WARNING: Data is lost when the application restarts.
 */
import type { StorageAdapter, StoredCredential, StoredSession } from "../types";
export declare class MemoryStorage implements StorageAdapter {
    private credentials;
    private session;
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
//# sourceMappingURL=memory.d.ts.map