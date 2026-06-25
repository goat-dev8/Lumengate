/**
 * localStorage Storage Adapter
 *
 * Simple localStorage-based storage for credentials. Works in browsers
 * and provides persistence across page reloads.
 *
 * Note: localStorage has a 5MB limit and data is not encrypted.
 * For production use, consider IndexedDB or server-side storage.
 */
import { LOCALSTORAGE_CREDENTIALS_KEY, LOCALSTORAGE_SESSION_KEY } from "../constants";
const STORAGE_KEY = LOCALSTORAGE_CREDENTIALS_KEY;
const SESSION_KEY = LOCALSTORAGE_SESSION_KEY;
/**
 * Helper to serialize Uint8Array for JSON storage
 */
function serializeCredential(credential) {
    return {
        ...credential,
        publicKey: Array.from(credential.publicKey),
    };
}
/**
 * Helper to deserialize Uint8Array from JSON storage
 */
function deserializeCredential(data) {
    return {
        ...data,
        publicKey: new Uint8Array(data.publicKey),
    };
}
export class LocalStorageAdapter {
    storageKey;
    constructor(storageKey = STORAGE_KEY) {
        this.storageKey = storageKey;
    }
    getStorage() {
        if (typeof localStorage === "undefined") {
            throw new Error("localStorage is not available in this environment");
        }
        const data = localStorage.getItem(this.storageKey);
        if (!data) {
            return new Map();
        }
        try {
            const parsed = JSON.parse(data);
            const map = new Map();
            for (const [key, value] of Object.entries(parsed)) {
                map.set(key, deserializeCredential(value));
            }
            return map;
        }
        catch {
            return new Map();
        }
    }
    setStorage(credentials) {
        const obj = {};
        for (const [key, value] of credentials.entries()) {
            obj[key] = serializeCredential(value);
        }
        localStorage.setItem(this.storageKey, JSON.stringify(obj));
    }
    async save(credential) {
        const credentials = this.getStorage();
        credentials.set(credential.credentialId, credential);
        this.setStorage(credentials);
    }
    async get(credentialId) {
        const credentials = this.getStorage();
        return credentials.get(credentialId) ?? null;
    }
    async getByContract(contractId) {
        const credentials = this.getStorage();
        const results = [];
        for (const credential of credentials.values()) {
            if (credential.contractId === contractId) {
                results.push(credential);
            }
        }
        return results;
    }
    async getAll() {
        const credentials = this.getStorage();
        return Array.from(credentials.values());
    }
    async delete(credentialId) {
        const credentials = this.getStorage();
        credentials.delete(credentialId);
        this.setStorage(credentials);
    }
    async update(credentialId, updates) {
        const credentials = this.getStorage();
        const credential = credentials.get(credentialId);
        if (credential) {
            credentials.set(credentialId, { ...credential, ...updates });
            this.setStorage(credentials);
        }
    }
    async clear() {
        localStorage.removeItem(this.storageKey);
        localStorage.removeItem(SESSION_KEY);
    }
    async saveSession(session) {
        if (typeof localStorage === "undefined") {
            throw new Error("localStorage is not available in this environment");
        }
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }
    async getSession() {
        if (typeof localStorage === "undefined") {
            return null;
        }
        const data = localStorage.getItem(SESSION_KEY);
        if (!data) {
            return null;
        }
        try {
            return JSON.parse(data);
        }
        catch {
            return null;
        }
    }
    async clearSession() {
        if (typeof localStorage !== "undefined") {
            localStorage.removeItem(SESSION_KEY);
        }
    }
}
//# sourceMappingURL=localStorage.js.map