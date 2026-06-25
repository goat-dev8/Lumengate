import { hash } from "@stellar/stellar-sdk";
import { buildKeyData } from "../utils";
import { Client as SmartAccountClient } from "smart-account-kit-bindings";
import { getSubmissionMethod } from "./tx-ops";
async function sendDeploymentTxViaRpc(tx) {
    const sentTx = await tx.send();
    const txResponse = sentTx.getTransactionResponse;
    return {
        hashValue: sentTx.sendTransactionResponse?.hash ?? "",
        ledger: txResponse?.status === "SUCCESS" ? txResponse.ledger : undefined,
    };
}
export async function submitDeploymentTx(deps, tx, credentialId, options) {
    try {
        let hashValue;
        let ledger;
        const method = getSubmissionMethod(deps.relayer, options);
        if (method === "relayer" && tx.signed && deps.relayer) {
            const relayerResult = await deps.relayer.sendXdr(tx.signed);
            if (!relayerResult.success) {
                if (options?.forceMethod === "relayer") {
                    throw new Error(relayerResult.error ?? "Relayer submission failed");
                }
                ({ hashValue, ledger } = await sendDeploymentTxViaRpc(tx));
            }
            else {
                hashValue = relayerResult.hash ?? "";
                const txResult = await deps.rpc.pollTransaction(hashValue, { attempts: 10 });
                if (txResult.status === "SUCCESS") {
                    ledger = txResult.ledger;
                }
                else if (txResult.status === "FAILED") {
                    throw new Error("Transaction failed on-chain");
                }
            }
        }
        else {
            ({ hashValue, ledger } = await sendDeploymentTxViaRpc(tx));
        }
        await deps.storage.delete(credentialId);
        return {
            success: true,
            hash: hashValue,
            ledger,
        };
    }
    catch (err) {
        const error = err instanceof Error ? err.message : "Transaction failed";
        await deps.storage.update(credentialId, {
            deploymentStatus: "failed",
            deploymentError: error,
        });
        return {
            success: false,
            hash: "",
            error,
        };
    }
}
export async function buildDeployTransaction(deps, credentialId, publicKey) {
    const keyData = buildKeyData(publicKey, credentialId);
    const signer = {
        tag: "External",
        values: [
            deps.webauthnVerifierAddress,
            keyData,
        ],
    };
    return SmartAccountClient.deploy({
        signers: [signer],
        policies: new Map(),
    }, {
        networkPassphrase: deps.networkPassphrase,
        rpcUrl: deps.rpcUrl,
        wasmHash: deps.accountWasmHash,
        publicKey: deps.deployerKeypair.publicKey(),
        salt: hash(credentialId),
        timeoutInSeconds: deps.timeoutInSeconds,
    });
}
//# sourceMappingURL=deploy-ops.js.map