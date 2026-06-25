/**
 * In-Memory Storage Adapter
 *
 * Simple in-memory storage for credentials. Useful for testing or
 * server-side environments where persistence isn't needed.
 *
 * WARNING: Data is lost when the application restarts.
 */
export class MemoryStorage {
    credentials = new Map();
    session = null;
    async save(credential) {
        this.credentials.set(credential.credentialId, { ...credential });
    }
    async get(credentialId) {
        const credential = this.credentials.get(credentialId);
        return credential ? { ...credential } : null;
    }
    async getByContract(contractId) {
        const results = [];
        for (const credential of this.credentials.values()) {
            if (credential.contractId === contractId) {
                results.push({ ...credential });
            }
        }
        return results;
    }
    async getAll() {
        return Array.from(this.credentials.values()).map((c) => ({ ...c }));
    }
    async delete(credentialId) {
        this.credentials.delete(credentialId);
    }
    async update(credentialId, updates) {
        const credential = this.credentials.get(credentialId);
        if (credential) {
            this.credentials.set(credentialId, { ...credential, ...updates });
        }
    }
    async clear() {
        this.credentials.clear();
        this.session = null;
    }
    async saveSession(session) {
        this.session = { ...session };
    }
    async getSession() {
        return this.session ? { ...this.session } : null;
    }
    async clearSession() {
        this.session = null;
    }
}
//# sourceMappingURL=memory.js.map