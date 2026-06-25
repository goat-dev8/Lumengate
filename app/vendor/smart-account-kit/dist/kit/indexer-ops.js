import base64url from "base64url";
export async function discoverContractsByCredential(indexer, credentialId) {
    if (!indexer)
        return null;
    const hexCredentialId = normalizeCredentialIdToHex(credentialId);
    const result = await indexer.lookupByCredentialId(hexCredentialId);
    return result.contracts;
}
export async function discoverContractsByAddress(indexer, address) {
    if (!indexer)
        return null;
    const result = await indexer.lookupByAddress(address);
    return result.contracts;
}
export async function getContractDetailsFromIndexer(indexer, contractId) {
    if (!indexer)
        return null;
    return indexer.getContractDetails(contractId);
}
function normalizeCredentialIdToHex(credentialId) {
    if (/^[0-9a-fA-F]+$/.test(credentialId)) {
        return credentialId.toLowerCase();
    }
    try {
        const bytes = base64url.toBuffer(credentialId);
        return bytes.toString("hex");
    }
    catch {
        return credentialId.toLowerCase();
    }
}
//# sourceMappingURL=indexer-ops.js.map