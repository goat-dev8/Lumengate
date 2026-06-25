/**
 * Signer Manager
 *
 * Manages signers (passkeys and delegated accounts) for context rules.
 */
import { buildKeyData } from "../utils";
/**
 * Manages signers for smart account context rules.
 */
export class SignerManager {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    /**
     * Add a new passkey signer to a context rule.
     * Creates a new WebAuthn passkey and registers it as an External signer.
     */
    async addPasskey(contextRuleId, appName, userName, options) {
        const { wallet, contractId } = this.deps.requireWallet();
        // Create the passkey
        const { rawResponse, credentialId, publicKey } = await this.deps.createPasskey(appName, userName);
        // Store the credential
        const storedCredential = {
            credentialId,
            publicKey,
            contractId,
            nickname: options?.nickname ?? `${userName} - ${new Date().toLocaleDateString()}`,
            createdAt: Date.now(),
            transports: rawResponse.response.transports,
            isPrimary: false,
            contextRuleId,
        };
        await this.deps.storage.save(storedCredential);
        // Emit credential created event
        this.deps.events.emit("credentialCreated", { credential: storedCredential });
        // Build the External signer for the contract
        const keyData = buildKeyData(publicKey, credentialId);
        const signer = {
            tag: "External",
            values: [this.deps.webauthnVerifierAddress, keyData],
        };
        // Build and return the add_signer transaction
        const transaction = await wallet.add_signer({
            context_rule_id: contextRuleId,
            signer,
        });
        return {
            credentialId,
            publicKey,
            transaction,
        };
    }
    /**
     * Add a delegated signer (Stellar account) to a context rule.
     */
    async addDelegated(contextRuleId, publicKey) {
        const { wallet } = this.deps.requireWallet();
        const signer = {
            tag: "Delegated",
            values: [publicKey],
        };
        return wallet.add_signer({
            context_rule_id: contextRuleId,
            signer,
        });
    }
    /**
     * Remove a signer from a context rule.
     */
    async remove(contextRuleId, signer) {
        const { wallet } = this.deps.requireWallet();
        const signerId = (await wallet.get_signer_id({
            signer,
        })).result;
        if (signerId === undefined || signerId === null) {
            throw new Error(`Signer not found on context rule ${contextRuleId}`);
        }
        return wallet.remove_signer({
            context_rule_id: contextRuleId,
            signer_id: signerId,
        });
    }
}
//# sourceMappingURL=signer-manager.js.map