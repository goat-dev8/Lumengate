import { rpc } from "@stellar/stellar-sdk";
import { Address, Keypair, Operation, TransactionBuilder, hash, xdr, } from "@stellar/stellar-sdk";
import { BASE_FEE, FRIENDBOT_RESERVE_XLM, FRIENDBOT_URL, LEDGERS_PER_HOUR, } from "../constants";
import { buildAddressSignatureScVal } from "./auth-payload";
import { xlmToStroops, stroopsToXlm } from "../utils";
export function getSubmissionMethod(relayer, options) {
    if (options?.forceMethod) {
        return options.forceMethod;
    }
    if (relayer) {
        return "relayer";
    }
    return "rpc";
}
export function shouldUseFeeSponsoring(relayer, options) {
    return getSubmissionMethod(relayer, options) === "relayer";
}
export async function sendAndPoll(deps, transaction, options) {
    const method = getSubmissionMethod(deps.relayer, options);
    let hash;
    switch (method) {
        case "relayer": {
            if (!deps.relayer) {
                return {
                    success: false,
                    hash: "",
                    error: "Relayer is not configured",
                };
            }
            const operations = transaction.operations;
            if (operations.length !== 1) {
                return {
                    success: false,
                    hash: "",
                    error: "Relayer requires exactly one invokeHostFunction operation",
                };
            }
            const op = operations[0];
            if (op.type !== "invokeHostFunction") {
                return {
                    success: false,
                    hash: "",
                    error: "Relayer only supports invokeHostFunction operations",
                };
            }
            const invokeOp = op;
            const funcXdr = invokeOp.func.toXDR("base64");
            const authXdrs = (invokeOp.auth ?? []).map((entry) => entry.toXDR("base64"));
            const relayerResult = await deps.relayer.send(funcXdr, authXdrs);
            if (!relayerResult.success) {
                return {
                    success: false,
                    hash: "",
                    error: relayerResult.error ?? "Relayer submission failed",
                };
            }
            hash = relayerResult.hash ?? "";
            break;
        }
        case "rpc":
        default: {
            const sendResult = await deps.rpc.sendTransaction(transaction);
            if (sendResult.status === "ERROR") {
                return {
                    success: false,
                    hash: sendResult.hash,
                    error: sendResult.errorResult?.toXDR("base64") ?? "Transaction submission failed",
                };
            }
            hash = sendResult.hash;
            break;
        }
    }
    const txResult = await deps.rpc.pollTransaction(hash, {
        attempts: 10,
    });
    if (txResult.status === "SUCCESS") {
        return {
            success: true,
            hash,
            ledger: txResult.ledger,
        };
    }
    if (txResult.status === "FAILED") {
        return {
            success: false,
            hash,
            error: "Transaction failed on-chain",
        };
    }
    return {
        success: false,
        hash,
        error: "Transaction confirmation timed out",
    };
}
export function hasSourceAccountAuth(transaction) {
    for (const op of transaction.operations) {
        if (op.type !== "invokeHostFunction")
            continue;
        const invokeOp = op;
        if (!invokeOp.auth)
            continue;
        for (const entry of invokeOp.auth) {
            if (entry.credentials().switch().name === "sorobanCredentialsSourceAccount") {
                return true;
            }
        }
    }
    return false;
}
export function buildTokenTransferHostFunction(tokenContract, fromAddress, toAddress, amountInStroops) {
    return xdr.HostFunction.hostFunctionTypeInvokeContract(new xdr.InvokeContractArgs({
        contractAddress: Address.fromString(tokenContract).toScAddress(),
        functionName: "transfer",
        args: [
            xdr.ScVal.scvAddress(Address.fromString(fromAddress).toScAddress()),
            xdr.ScVal.scvAddress(Address.fromString(toAddress).toScAddress()),
            xdr.ScVal.scvI128(new xdr.Int128Parts({
                lo: xdr.Uint64.fromString((amountInStroops & BigInt("0xFFFFFFFFFFFFFFFF")).toString()),
                hi: xdr.Int64.fromString((amountInStroops >> BigInt(64)).toString()),
            })),
        ],
    }));
}
export function buildTokenTransferTargetArgs(wallet, fromAddress, toAddress, amountInStroops) {
    const spec = wallet?.spec;
    if (spec && typeof spec.nativeToScVal === "function") {
        return [
            spec.nativeToScVal(fromAddress, xdr.ScSpecTypeDef.scSpecTypeAddress()),
            spec.nativeToScVal(toAddress, xdr.ScSpecTypeDef.scSpecTypeAddress()),
            spec.nativeToScVal(amountInStroops, xdr.ScSpecTypeDef.scSpecTypeI128()),
        ];
    }
    return [
        xdr.ScVal.scvAddress(Address.fromString(fromAddress).toScAddress()),
        xdr.ScVal.scvAddress(Address.fromString(toAddress).toScAddress()),
        xdr.ScVal.scvI128(new xdr.Int128Parts({
            lo: xdr.Uint64.fromString((amountInStroops & BigInt("0xFFFFFFFFFFFFFFFF")).toString()),
            hi: xdr.Int64.fromString((amountInStroops >> BigInt(64)).toString()),
        })),
    ];
}
export async function simulateHostFunction(deps, hostFunc) {
    let sourceAccount;
    try {
        sourceAccount = await deps.rpc.getAccount(deps.deployerKeypair.publicKey());
    }
    catch (error) {
        throw new Error(`Simulation requires the deployer account to exist on-chain. ` +
            `Fund ${deps.deployerKeypair.publicKey()} before simulating transactions.`);
    }
    const simulationTx = new TransactionBuilder(sourceAccount, {
        fee: BASE_FEE,
        networkPassphrase: deps.networkPassphrase,
    })
        .addOperation(Operation.invokeHostFunction({
        func: hostFunc,
        auth: [],
    }))
        .setTimeout(deps.timeoutInSeconds)
        .build();
    const simResult = await deps.rpc.simulateTransaction(simulationTx);
    if ("error" in simResult) {
        throw new Error(`Simulation failed: ${simResult.error}`);
    }
    return {
        authEntries: simResult.result?.auth || [],
    };
}
export async function signResimulateAndPrepare(deps, hostFunc, authEntries, options) {
    const signedAuthEntries = [];
    for (const [index, authEntry] of authEntries.entries()) {
        const signedEntry = await deps.signAuthEntry(authEntry, {
            credentialId: options?.credentialId,
            expiration: options?.expiration,
            contextRuleIds: options?.resolveContextRuleIds
                ? await options.resolveContextRuleIds(authEntry, index)
                : undefined,
        });
        signedAuthEntries.push(signedEntry);
    }
    let sourceAccount;
    try {
        sourceAccount = await deps.rpc.getAccount(deps.deployerKeypair.publicKey());
    }
    catch (error) {
        throw new Error(`Re-simulation requires the deployer account to exist on-chain. ` +
            `Fund ${deps.deployerKeypair.publicKey()} before re-simulating transactions.`);
    }
    const resimTx = new TransactionBuilder(sourceAccount, {
        fee: BASE_FEE,
        networkPassphrase: deps.networkPassphrase,
    })
        .addOperation(Operation.invokeHostFunction({
        func: hostFunc,
        auth: signedAuthEntries,
    }))
        .setTimeout(deps.timeoutInSeconds)
        .build();
    const resimResult = await deps.rpc.simulateTransaction(resimTx);
    if ("error" in resimResult) {
        throw new Error(`Re-simulation failed: ${resimResult.error}`);
    }
    const resimTxXdr = resimTx.toXDR();
    const normalizedTx = TransactionBuilder.fromXDR(resimTxXdr, deps.networkPassphrase);
    const assembled = rpc.assembleTransaction(normalizedTx, resimResult);
    return assembled.build();
}
export async function sign(deps, transaction, options) {
    const contractId = deps.getContractId();
    if (!contractId) {
        throw new Error("Not connected to a wallet. Call connectWallet() first.");
    }
    const credentialId = options?.credentialId ?? deps.getCredentialId();
    const expiration = options?.expiration ?? await deps.calculateExpiration();
    await transaction.signAuthEntries({
        address: contractId,
        authorizeEntry: async (entry) => {
            const clone = xdr.SorobanAuthorizationEntry.fromXDR(entry.toXDR());
            const authEntries = transaction.simulationData?.result?.auth || [];
            const entryIndex = authEntries.findIndex((authEntry) => authEntry.toXDR("base64") === entry.toXDR("base64"));
            return deps.signAuthEntry(clone, {
                credentialId,
                expiration,
                contextRuleIds: entryIndex >= 0 && options?.resolveContextRuleIds
                    ? await options.resolveContextRuleIds(clone, entryIndex)
                    : undefined,
            });
        },
    });
    return transaction;
}
export async function signAndSubmit(deps, transaction, options) {
    if (!deps.getContractId()) {
        return { success: false, hash: "", error: "Not connected to a wallet. Call connectWallet() first." };
    }
    try {
        const builtTx = transaction.built;
        if (!builtTx) {
            return { success: false, hash: "", error: "Transaction has no built transaction" };
        }
        const operations = builtTx.operations;
        if (operations.length !== 1) {
            return { success: false, hash: "", error: "Expected exactly one operation" };
        }
        const operation = operations[0];
        if (operation.type !== "invokeHostFunction") {
            return { success: false, hash: "", error: "Expected invokeHostFunction operation" };
        }
        const invokeOp = operation;
        const simData = transaction.simulationData;
        if (!simData?.result?.auth) {
            return { success: false, hash: "", error: "No simulation data or auth entries" };
        }
        const preparedTx = await deps.signResimulateAndPrepare(invokeOp.func, simData.result.auth, {
            credentialId: options?.credentialId,
            expiration: options?.expiration,
            resolveContextRuleIds: options?.resolveContextRuleIds,
        });
        const submissionOpts = { forceMethod: options?.forceMethod };
        if (!deps.shouldUseFeeSponsoring(submissionOpts) || deps.hasSourceAccountAuth(preparedTx)) {
            preparedTx.sign(deps.deployerKeypair);
        }
        return deps.sendAndPoll(preparedTx, submissionOpts);
    }
    catch (err) {
        return {
            success: false,
            hash: "",
            error: err instanceof Error ? err.message : "Unknown error",
        };
    }
}
export async function fundWallet(deps, nativeTokenContract, options) {
    const contractId = deps.getContractId();
    if (!contractId) {
        return { success: false, hash: "", error: "Not connected to a wallet" };
    }
    if (!deps.networkPassphrase.includes("Test")) {
        return {
            success: false,
            hash: "",
            error: "fundWallet() only works on testnet",
        };
    }
    try {
        const tempKeypair = Keypair.random();
        const friendbotResponse = await fetch(`${FRIENDBOT_URL}?addr=${tempKeypair.publicKey()}`);
        if (!friendbotResponse.ok) {
            const text = await friendbotResponse.text();
            return { success: false, hash: "", error: `Friendbot error: ${text}` };
        }
        const RESERVE_XLM = FRIENDBOT_RESERVE_XLM;
        let sourceAccount = await deps.rpc.getAccount(tempKeypair.publicKey());
        const fromAddress = Address.fromString(tempKeypair.publicKey());
        const balanceKey = xdr.ScVal.scvVec([
            xdr.ScVal.scvSymbol("Balance"),
            xdr.ScVal.scvAddress(fromAddress.toScAddress()),
        ]);
        let balanceXlm;
        try {
            const balanceData = await deps.rpc.getContractData(nativeTokenContract, balanceKey);
            const val = balanceData.val.contractData().val();
            if (val.switch().name === "scvI128") {
                const i128 = val.i128();
                const lo = BigInt(i128.lo().toString());
                const hi = BigInt(i128.hi().toString());
                const balanceStroops = (hi << BigInt(64)) | lo;
                balanceXlm = stroopsToXlm(balanceStroops);
            }
            else {
                balanceXlm = 10_000;
            }
        }
        catch (error) {
            console.warn("[SmartAccountKit] Failed to fetch temp account balance, using default:", error);
            balanceXlm = 10_000;
        }
        const transferAmount = balanceXlm - RESERVE_XLM;
        if (transferAmount <= 0) {
            return { success: false, hash: "", error: "Insufficient balance after reserve" };
        }
        const amountInStroops = xlmToStroops(transferAmount);
        const transferOp = Operation.invokeHostFunction({
            func: buildTokenTransferHostFunction(nativeTokenContract, fromAddress.toString(), contractId, amountInStroops),
            auth: [],
        });
        const simulationTx = new TransactionBuilder(sourceAccount, {
            fee: BASE_FEE,
            networkPassphrase: deps.networkPassphrase,
        })
            .addOperation(transferOp)
            .setTimeout(30)
            .build();
        const simResult = await deps.rpc.simulateTransaction(simulationTx);
        if ("error" in simResult) {
            return { success: false, hash: "", error: `Simulation failed: ${simResult.error}` };
        }
        const authEntries = simResult.result?.auth || [];
        const signedAuthEntries = [];
        const currentLedger = simResult.latestLedger;
        const expirationLedger = currentLedger + LEDGERS_PER_HOUR; // ~1 hour
        for (const entry of authEntries) {
            const credType = entry.credentials().switch().name;
            // For source_account credentials, convert to Address credentials
            // so the Relayer can use its own channel accounts
            if (credType === "sorobanCredentialsSourceAccount") {
                // Generate a nonce for the new Address credential
                const nonce = xdr.Int64.fromString(Date.now().toString());
                const preimage = xdr.HashIdPreimage.envelopeTypeSorobanAuthorization(new xdr.HashIdPreimageSorobanAuthorization({
                    networkId: hash(Buffer.from(deps.networkPassphrase)),
                    nonce,
                    signatureExpirationLedger: expirationLedger,
                    invocation: entry.rootInvocation(),
                }));
                const payload = hash(preimage.toXDR());
                const signature = tempKeypair.sign(payload);
                // Create new Address credentials entry to replace source_account
                const addressEntry = new xdr.SorobanAuthorizationEntry({
                    credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(new xdr.SorobanAddressCredentials({
                        address: Address.fromString(tempKeypair.publicKey()).toScAddress(),
                        nonce,
                        signatureExpirationLedger: expirationLedger,
                        signature: buildAddressSignatureScVal(tempKeypair.rawPublicKey(), signature),
                    })),
                    rootInvocation: entry.rootInvocation(),
                });
                signedAuthEntries.push(addressEntry);
                continue;
            }
            // For Address credentials, sign them
            if (credType === "sorobanCredentialsAddress") {
                const credentials = entry.credentials().address();
                credentials.signatureExpirationLedger(expirationLedger);
                const preimage = xdr.HashIdPreimage.envelopeTypeSorobanAuthorization(new xdr.HashIdPreimageSorobanAuthorization({
                    networkId: hash(Buffer.from(deps.networkPassphrase)),
                    nonce: credentials.nonce(),
                    signatureExpirationLedger: credentials.signatureExpirationLedger(),
                    invocation: entry.rootInvocation(),
                }));
                const payload = hash(preimage.toXDR());
                const signature = tempKeypair.sign(payload);
                credentials.signature(buildAddressSignatureScVal(tempKeypair.rawPublicKey(), signature));
                signedAuthEntries.push(entry);
                continue;
            }
            // Unknown credential type - push as-is (shouldn't happen)
            signedAuthEntries.push(entry);
        }
        sourceAccount = await deps.rpc.getAccount(tempKeypair.publicKey());
        const invokeHostFn = simulationTx.operations[0];
        const txWithAuth = new TransactionBuilder(sourceAccount, {
            fee: BASE_FEE,
            networkPassphrase: deps.networkPassphrase,
        })
            .addOperation(Operation.invokeHostFunction({
            func: invokeHostFn.func,
            auth: signedAuthEntries,
        }))
            .setTimeout(30)
            .build();
        const resimResult = await deps.rpc.simulateTransaction(txWithAuth);
        if ("error" in resimResult) {
            return { success: false, hash: "", error: `Re-simulation failed: ${resimResult.error}` };
        }
        const txWithAuthXdr = txWithAuth.toXDR();
        const normalizedTxWithAuth = TransactionBuilder.fromXDR(txWithAuthXdr, deps.networkPassphrase);
        const preparedTx = rpc.assembleTransaction(normalizedTxWithAuth, resimResult).build();
        const submissionOpts = { forceMethod: options?.forceMethod };
        if (!deps.shouldUseFeeSponsoring(submissionOpts) || deps.hasSourceAccountAuth(preparedTx)) {
            preparedTx.sign(tempKeypair);
        }
        const txResult = await deps.sendAndPoll(preparedTx, submissionOpts);
        return {
            ...txResult,
            amount: txResult.success ? transferAmount : undefined,
        };
    }
    catch (err) {
        return {
            success: false,
            hash: "",
            error: err instanceof Error ? err.message : "Unknown error",
        };
    }
}
//# sourceMappingURL=tx-ops.js.map