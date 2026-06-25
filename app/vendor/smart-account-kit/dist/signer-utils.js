import base64url from "base64url";
import { SECP256R1_PUBLIC_KEY_SIZE } from "./constants";
export function getCredentialIdFromSigner(signer) {
    if (signer.tag !== "External") {
        return null;
    }
    const keyData = Buffer.from(signer.values[1]);
    if (keyData.length <= SECP256R1_PUBLIC_KEY_SIZE) {
        return null;
    }
    const credentialId = keyData.slice(SECP256R1_PUBLIC_KEY_SIZE);
    return base64url.encode(credentialId);
}
export function signersEqual(a, b) {
    if (a.tag !== b.tag)
        return false;
    if (a.tag === "Delegated" && b.tag === "Delegated") {
        return a.values[0] === b.values[0];
    }
    if (a.tag === "External" && b.tag === "External") {
        const aVerifier = a.values[0];
        const bVerifier = b.values[0];
        const aKey = Buffer.from(a.values[1]);
        const bKey = Buffer.from(b.values[1]);
        return aVerifier === bVerifier && aKey.equals(bKey);
    }
    return false;
}
export function getSignerKey(signer) {
    if (signer.tag === "Delegated") {
        return `delegated:${signer.values[0]}`;
    }
    const keyData = Buffer.from(signer.values[1]);
    return `external:${signer.values[0]}:${keyData.toString("hex")}`;
}
export function collectUniqueSigners(signers) {
    const signerMap = new Map();
    for (const signer of signers) {
        const key = getSignerKey(signer);
        if (!signerMap.has(key)) {
            signerMap.set(key, signer);
        }
    }
    return Array.from(signerMap.values());
}
//# sourceMappingURL=signer-utils.js.map