import { xdr } from "@stellar/stellar-sdk";
import base64url from "base64url";
import { WEBAUTHN_TIMEOUT_MS } from "../constants";
import { compactSignature, extractPublicKeyFromAttestation, generateChallenge, } from "../utils";
import { buildAuthDigest, buildSignaturePayload, buildWebAuthnSignatureBytes, readAuthPayload, upsertAuthPayloadSigner, writeAuthPayload, } from "./auth-payload";
import { findWebAuthnSignerInRules, } from "./context-rules";
export async function createPasskey(deps, appName, userName, authenticatorSelection) {
    const now = new Date();
    const displayName = `${userName} — ${now.toLocaleString()}`;
    const options = {
        challenge: generateChallenge(),
        rp: {
            id: deps.rpId,
            name: appName || deps.rpName,
        },
        user: {
            id: base64url(`${userName}:${now.getTime()}:${Math.random()}`),
            name: displayName,
            displayName,
        },
        authenticatorSelection: {
            residentKey: authenticatorSelection?.residentKey ?? "preferred",
            userVerification: authenticatorSelection?.userVerification ?? "preferred",
            authenticatorAttachment: authenticatorSelection?.authenticatorAttachment,
        },
        pubKeyCredParams: [{ alg: -7, type: "public-key" }],
        timeout: WEBAUTHN_TIMEOUT_MS,
    };
    const rawResponse = await deps.webAuthn.startRegistration({ optionsJSON: options });
    const publicKey = await extractPublicKeyFromAttestation(rawResponse.response);
    return {
        rawResponse,
        credentialId: rawResponse.id,
        publicKey,
    };
}
export async function authenticatePasskey(deps) {
    const authOptions = {
        challenge: generateChallenge(),
        rpId: deps.rpId,
        userVerification: "preferred",
        timeout: WEBAUTHN_TIMEOUT_MS,
    };
    const rawResponse = await deps.webAuthn.startAuthentication({ optionsJSON: authOptions });
    return {
        credentialId: rawResponse.id,
        rawResponse,
    };
}
export async function signAuthEntry(deps, entry, options) {
    const normalizedEntry = xdr.SorobanAuthorizationEntry.fromXDR(entry.toXDR());
    const credentials = normalizedEntry.credentials().address();
    const expiration = options?.expiration ?? await deps.calculateExpiration();
    credentials.signatureExpirationLedger(expiration);
    const authPayload = readAuthPayload(credentials.signature());
    const credentialId = options?.credentialId ?? deps.getCredentialId();
    if (!credentialId) {
        throw new Error("A credential ID is required to sign smart account auth entries");
    }
    const contextRuleIds = options?.contextRuleIds ?? authPayload.context_rule_ids;
    if (contextRuleIds.length === 0) {
        throw new Error("contextRuleIds are required to sign smart account auth entries when the payload does not already include them");
    }
    const { wallet } = deps.requireWallet();
    const credentialIdBuffer = base64url.toBuffer(credentialId);
    const signer = options?.signer ?? await findWebAuthnSignerInRules(wallet, contextRuleIds, credentialIdBuffer, {
        rpc: deps.rpc,
        contractId: deps.requireWallet().contractId,
        networkPassphrase: deps.networkPassphrase,
        timeoutInSeconds: deps.timeoutInSeconds,
    });
    const signaturePayload = buildSignaturePayload(deps.networkPassphrase, normalizedEntry, credentials.signatureExpirationLedger());
    const authDigest = buildAuthDigest(signaturePayload, contextRuleIds);
    const authResponse = await deps.webAuthn.startAuthentication({
        optionsJSON: {
            challenge: base64url(authDigest),
            rpId: deps.rpId,
            userVerification: "preferred",
            timeout: WEBAUTHN_TIMEOUT_MS,
            allowCredentials: [{ id: credentialId, type: "public-key" }],
        },
    });
    const rawSignature = base64url.toBuffer(authResponse.response.signature);
    const compactedSignature = compactSignature(rawSignature);
    const webAuthnSigData = {
        authenticator_data: base64url.toBuffer(authResponse.response.authenticatorData),
        client_data: base64url.toBuffer(authResponse.response.clientDataJSON),
        signature: Buffer.from(compactedSignature),
    };
    if (authPayload.context_rule_ids.length > 0 &&
        authPayload.context_rule_ids.join(",") !== contextRuleIds.join(",")) {
        throw new Error("Existing auth payload uses different context rule IDs");
    }
    authPayload.context_rule_ids = contextRuleIds;
    upsertAuthPayloadSigner(authPayload, signer, buildWebAuthnSignatureBytes(webAuthnSigData));
    credentials.signature(writeAuthPayload(authPayload));
    await deps.storage.update(credentialId, { lastUsedAt: Date.now() });
    return normalizedEntry;
}
//# sourceMappingURL=webauthn-ops.js.map