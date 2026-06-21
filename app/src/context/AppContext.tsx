import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  StellarWalletsKit,
  WalletNetwork,
  allowAllModules,
  type ISupportedWallet,
} from '@creit.tech/stellar-wallets-kit';
import {
  loadDeploymentConfig,
  fetchIssuerCredential,
  type DeploymentConfig,
  type IssuerCredentialResponse,
} from '../lib/config';
import type { ProofBundle } from '../lib/contracts';
import { appendActivity, loadActivity, type ActivityEntry } from '../lib/activity';
import { walletFieldFromAddress } from '../lib/utils';
import { warmProver } from '../lib/prover';
import {
  buildTransferTransaction,
  formatSorobanUserError,
  readBalance,
  submitSignedTransaction,
} from '../lib/contracts';
import {
  loadWalletSession,
  saveWalletSession,
  migrateLegacySession,
  type WalletSession,
} from '../lib/session';
import { proofMatchesCredential } from '../lib/credentialProof';
import type { PolicyKey } from '../lib/policies';
import { buildDisclosurePack, type DisclosurePack } from '../lib/disclosure';
import { generatePofProof } from '../lib/pofProver';
import {
  buildProofReceipt,
  type ProofReceipt,
  type ProofReceiptTransactions,
  type ProofReceiptTransferResult,
} from '../lib/proofReceipt';

type AppContextValue = {
  config: DeploymentConfig;
  address: string | null;
  walletField: string | null;
  walletModuleId: string | null;
  walletModuleName: string | null;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  kit: StellarWalletsKit | null;
  credential: IssuerCredentialResponse | null;
  proof: ProofBundle | null;
  pofProof: ProofBundle | null;
  proofDurationSec: number | null;
  policyKey: PolicyKey;
  selectedOfferingId: string | null;
  receiptTransactions: ProofReceiptTransactions;
  transferResult: ProofReceiptTransferResult | null;
  replayBlocked: boolean;
  replayMessage: string | null;
  proofReceipt: ProofReceipt | null;
  receiptLoading: boolean;
  setCredential: (c: IssuerCredentialResponse | null) => void;
  setProof: (p: ProofBundle | null, durationSec?: number | null) => void;
  setPofProof: (p: ProofBundle | null) => void;
  generatePofProofForWallet: (threshold: bigint) => Promise<ProofBundle>;
  setPolicyKey: (key: PolicyKey) => void;
  setSelectedOfferingId: (id: string | null) => void;
  requestCredential: (policyKey?: PolicyKey) => Promise<IssuerCredentialResponse>;
  buildDisclosure: (txHash?: string) => DisclosurePack | null;
  refreshProofReceipt: (options?: RefreshProofReceiptOptions) => Promise<ProofReceipt | null>;
  recordTransferTx: (hash: string, result: ProofReceiptTransferResult) => Promise<ProofReceipt | null>;
  recordVerifyTx: (hash: string) => Promise<void>;
  demonstrateReplayBlock: (to: string, amount: string) => Promise<void>;
  activity: ActivityEntry[];
  pushActivity: (entry: Omit<ActivityEntry, 'id' | 'timestamp'>) => void;
  signAndSubmit: (xdr: string) => Promise<string>;
};

const AppContext = createContext<AppContextValue | null>(null);

const emptyReceiptTxs: ProofReceiptTransactions = {};

export type RefreshProofReceiptOptions = {
  transactions?: ProofReceiptTransactions;
  transferResult?: ProofReceiptTransferResult;
  replayBlocked?: boolean;
  replayMessage?: string;
};

export function AppProvider({ children }: { children: ReactNode }) {
  const config = useMemo(() => loadDeploymentConfig(), []);
  const [address, setAddress] = useState<string | null>(null);
  const [walletField, setWalletField] = useState<string | null>(null);
  const [walletModuleId, setWalletModuleId] = useState<string | null>(null);
  const [walletModuleName, setWalletModuleName] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [credential, setCredentialState] = useState<IssuerCredentialResponse | null>(null);
  const [proof, setProofState] = useState<ProofBundle | null>(null);
  const [pofProof, setPofProofState] = useState<ProofBundle | null>(null);
  const [proofDurationSec, setProofDurationSec] = useState<number | null>(null);
  const [policyKey, setPolicyKeyState] = useState<PolicyKey>('general-eligibility');
  const [selectedOfferingId, setSelectedOfferingIdState] = useState<string | null>(null);
  const [receiptTransactions, setReceiptTransactions] = useState<ProofReceiptTransactions>(emptyReceiptTxs);
  const [transferResult, setTransferResult] = useState<ProofReceiptTransferResult | null>(null);
  const [replayBlocked, setReplayBlocked] = useState(false);
  const [replayMessage, setReplayMessage] = useState<string | null>(null);
  const [proofReceipt, setProofReceipt] = useState<ProofReceipt | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [activity, setActivity] = useState<ActivityEntry[]>(() => loadActivity());

  const kit = useMemo(
    () =>
      new StellarWalletsKit({
        network: WalletNetwork.TESTNET,
        modules: allowAllModules(),
      }),
    [],
  );

  const persistSession = useCallback(
    (partial: Partial<WalletSession> & { address: string; walletField: string }) => {
      const existing = loadWalletSession(partial.address);
      const next: WalletSession = {
        address: partial.address,
        walletField: partial.walletField,
        walletModuleId: partial.walletModuleId ?? existing?.walletModuleId,
        walletModuleName: partial.walletModuleName ?? existing?.walletModuleName,
        credential: partial.credential !== undefined ? partial.credential : (existing?.credential ?? null),
        proof: partial.proof !== undefined ? partial.proof : (existing?.proof ?? null),
        pofProof: partial.pofProof !== undefined ? partial.pofProof : (existing?.pofProof ?? null),
        proofDurationSec:
          partial.proofDurationSec !== undefined
            ? partial.proofDurationSec
            : (existing?.proofDurationSec ?? null),
        policyKey: partial.policyKey ?? existing?.policyKey ?? 'general-eligibility',
        selectedOfferingId:
          partial.selectedOfferingId !== undefined
            ? partial.selectedOfferingId
            : (existing?.selectedOfferingId ?? null),
        receiptTransactions:
          partial.receiptTransactions ?? existing?.receiptTransactions ?? emptyReceiptTxs,
        transferResult:
          partial.transferResult !== undefined
            ? partial.transferResult
            : (existing?.transferResult ?? null),
        replayBlocked: partial.replayBlocked ?? existing?.replayBlocked ?? false,
        replayMessage:
          partial.replayMessage !== undefined
            ? partial.replayMessage
            : (existing?.replayMessage ?? null),
        updatedAt: Date.now(),
      };
      saveWalletSession(next);
    },
    [],
  );

  const applySession = useCallback((saved: WalletSession) => {
    setCredentialState(saved.credential);
    const proofOk = proofMatchesCredential(saved.proof, saved.credential);
    setProofState(proofOk ? saved.proof : null);
    setPofProofState(saved.pofProof ?? null);
    setProofDurationSec(proofOk ? saved.proofDurationSec : null);
    setPolicyKeyState(saved.policyKey ?? 'general-eligibility');
    setSelectedOfferingIdState(saved.selectedOfferingId);
    setWalletModuleId(saved.walletModuleId ?? null);
    setWalletModuleName(saved.walletModuleName ?? null);
    setReceiptTransactions(saved.receiptTransactions ?? emptyReceiptTxs);
    setTransferResult(saved.transferResult ?? null);
    setReplayBlocked(saved.replayBlocked ?? false);
    setReplayMessage(saved.replayMessage ?? null);
    if (saved.walletModuleId) {
      kit.setWallet(saved.walletModuleId);
    }
  }, [kit]);

  const restoreSession = useCallback(
    (addr: string, wf: string) => {
      let saved = loadWalletSession(addr);
      if (!saved) saved = migrateLegacySession(addr);
      if (!saved || saved.walletField !== wf) return;
      applySession(saved);
    },
    [applySession],
  );

  useEffect(() => {
    warmProver().catch(() => undefined);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { address: addr } = await kit.getAddress({ skipRequestAccess: true });
        const wf = await walletFieldFromAddress(addr);
        if (cancelled) return;
        setAddress(addr);
        setWalletField(wf);
        restoreSession(addr, wf);
      } catch {
        /* not connected */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [kit, restoreSession]);

  useEffect(() => {
    if (!credential || !proof) return;
    if (!proofMatchesCredential(proof, credential)) {
      setProofState(null);
      setProofDurationSec(null);
    }
  }, [credential, proof]);

  const refreshProofReceipt = useCallback(
    async (overrides?: RefreshProofReceiptOptions): Promise<ProofReceipt | null> => {
    if (!address || !walletField || !credential || !proof) {
      setProofReceipt(null);
      return null;
    }
    if (!proofMatchesCredential(proof, credential)) {
      setProofReceipt(null);
      return null;
    }
    setReceiptLoading(true);
    try {
      const receipt = await buildProofReceipt({
        config,
        address,
        walletField,
        walletModuleId: walletModuleId ?? undefined,
        walletModuleName: walletModuleName ?? undefined,
        policyKey,
        credential,
        proof,
        transactions: overrides?.transactions ?? receiptTransactions,
        transferResult: overrides?.transferResult ?? transferResult ?? undefined,
        replayBlocked: overrides?.replayBlocked ?? replayBlocked,
        replayMessage: overrides?.replayMessage ?? replayMessage ?? undefined,
      });
      setProofReceipt(receipt);
      return receipt;
    } finally {
      setReceiptLoading(false);
    }
  },
  [
    address,
    walletField,
    walletModuleId,
    walletModuleName,
    credential,
    proof,
    policyKey,
    config,
    receiptTransactions,
    transferResult,
    replayBlocked,
    replayMessage,
  ],
  );

  useEffect(() => {
    if (!address || !proof || !credential) {
      setProofReceipt(null);
      return;
    }
    refreshProofReceipt().catch(() => undefined);
  }, [
    address,
    proof,
    credential,
    receiptTransactions,
    transferResult,
    replayBlocked,
    replayMessage,
    refreshProofReceipt,
  ]);

  useEffect(() => {
    if (!address || !walletField) return;
    persistSession({
      address,
      walletField,
      credential,
      proof,
      pofProof,
      proofDurationSec,
      policyKey,
      selectedOfferingId,
      walletModuleId: walletModuleId ?? undefined,
      walletModuleName: walletModuleName ?? undefined,
      receiptTransactions,
      transferResult,
      replayBlocked,
      replayMessage,
    });
  }, [
    address,
    walletField,
    credential,
    proof,
    proofDurationSec,
    policyKey,
    selectedOfferingId,
    pofProof,
    walletModuleId,
    walletModuleName,
    receiptTransactions,
    transferResult,
    replayBlocked,
    replayMessage,
    persistSession,
  ]);

  const pushActivity = useCallback((entry: Omit<ActivityEntry, 'id' | 'timestamp'>) => {
    setActivity(appendActivity(entry));
  }, []);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      const walletRef: { current: ISupportedWallet | null } = { current: null };
      await new Promise<void>((resolve, reject) => {
        kit.openModal({
          modalTitle: 'Connect a Wallet',
          onWalletSelected: (option) => {
            walletRef.current = option;
            kit.setWallet(option.id);
            resolve();
          },
          onClosed: (err) => {
            if (err) reject(err);
            else reject(new Error('Wallet connection closed'));
          },
        });
      });
      const selected = walletRef.current;
      const { address: addr } = await kit.getAddress();
      const wf = await walletFieldFromAddress(addr);
      setAddress(addr);
      setWalletField(wf);
      setWalletModuleId(selected?.id ?? null);
      setWalletModuleName(selected?.name ?? null);
      restoreSession(addr, wf);
      persistSession({
        address: addr,
        walletField: wf,
        walletModuleId: selected?.id,
        walletModuleName: selected?.name,
      });
      pushActivity({
        kind: 'verify',
        title: 'Wallet connected',
        detail: selected?.name ? `${selected.name} · ${addr}` : addr,
        status: 'success',
      });
    } finally {
      setConnecting(false);
    }
  }, [kit, pushActivity, restoreSession, persistSession]);

  const disconnect = useCallback(() => {
    kit.disconnect().catch(() => undefined);
    setAddress(null);
    setWalletField(null);
    setWalletModuleId(null);
    setWalletModuleName(null);
    setCredentialState(null);
    setProofState(null);
    setProofDurationSec(null);
    setProofReceipt(null);
  }, [kit]);

  const setCredential = useCallback((c: IssuerCredentialResponse | null) => {
    setCredentialState(c);
    if (!c) setProofState(null);
  }, []);

  const setPolicyKey = useCallback((key: PolicyKey) => {
    setPolicyKeyState(key);
  }, []);

  const setSelectedOfferingId = useCallback((id: string | null) => {
    setSelectedOfferingIdState(id);
  }, []);

  const requestCredential = useCallback(
    async (requestedPolicyKey?: PolicyKey) => {
      if (!walletField || !address) throw new Error('Connect wallet first');
      const pk = requestedPolicyKey ?? policyKey;
      const cred = await fetchIssuerCredential(config.issuerServiceUrl, walletField, pk);
      setPolicyKeyState(pk);
      setCredentialState(cred);
      setProofState(null);
      setPofProofState(null);
      setProofDurationSec(null);
      persistSession({
        address,
        walletField,
        credential: cred,
        proof: null,
        pofProof: null,
        proofDurationSec: null,
        policyKey: pk,
        selectedOfferingId,
      });
      pushActivity({
        kind: 'credential',
        title: 'Credential received',
        detail: cred.label,
        status: 'info',
      });
      return cred;
    },
    [config.issuerServiceUrl, walletField, address, policyKey, selectedOfferingId, pushActivity, persistSession],
  );

  const setProof = useCallback(
    (p: ProofBundle | null, durationSec?: number | null) => {
      setProofState(p);
      const duration = durationSec ?? null;
      setProofDurationSec(duration);
      if (p) {
        setReceiptTransactions(emptyReceiptTxs);
        setTransferResult(null);
        setReplayBlocked(false);
        setReplayMessage(null);
        setProofReceipt(null);
      }
      if (address && walletField) {
        persistSession({
          address,
          walletField,
          credential,
          proof: p,
          pofProof,
          proofDurationSec: duration,
          policyKey,
          selectedOfferingId,
          receiptTransactions: p ? emptyReceiptTxs : receiptTransactions,
          transferResult: p ? null : transferResult,
          replayBlocked: p ? false : replayBlocked,
          replayMessage: p ? null : replayMessage,
        });
      }
    },
    [
      address,
      walletField,
      credential,
      policyKey,
      selectedOfferingId,
      pofProof,
      persistSession,
      receiptTransactions,
      transferResult,
      replayBlocked,
      replayMessage,
    ],
  );

  const setPofProof = useCallback(
    (p: ProofBundle | null) => {
      setPofProofState(p);
      if (address && walletField) {
        persistSession({
          address,
          walletField,
          credential,
          proof,
          pofProof: p,
          proofDurationSec,
          policyKey,
          selectedOfferingId,
        });
      }
    },
    [address, walletField, credential, proof, proofDurationSec, policyKey, selectedOfferingId, persistSession],
  );

  const generatePofProofForWallet = useCallback(
    async (threshold: bigint) => {
      if (!walletField || !address) throw new Error('Connect wallet first');
      const balance = BigInt(await readBalance(config, address));
      const bundle = await generatePofProof(config, { walletField, balance, threshold });
      setPofProofState(bundle);
      persistSession({
        address,
        walletField,
        credential,
        proof,
        pofProof: bundle,
        proofDurationSec,
        policyKey,
        selectedOfferingId,
      });
      pushActivity({
        kind: 'proof',
        title: 'Proof of funds generated',
        detail: `Threshold ${threshold.toString()} met without revealing balance`,
        status: 'success',
      });
      return bundle;
    },
    [walletField, address, config, credential, proof, proofDurationSec, policyKey, selectedOfferingId, persistSession, pushActivity],
  );

  const recordTransferTx = useCallback(
    async (hash: string, result: ProofReceiptTransferResult) => {
      const txs = { ...receiptTransactions, transfer: hash };
      setReceiptTransactions(txs);
      setTransferResult(result);
      if (address && walletField) {
        persistSession({ address, walletField, receiptTransactions: txs, transferResult: result });
      }
      return refreshProofReceipt({ transactions: txs, transferResult: result });
    },
    [receiptTransactions, address, walletField, persistSession, refreshProofReceipt],
  );

  const recordVerifyTx = useCallback(
    async (hash: string) => {
      const txs = { ...receiptTransactions, verify: hash };
      setReceiptTransactions(txs);
      if (address && walletField) {
        persistSession({ address, walletField, receiptTransactions: txs });
      }
    },
    [receiptTransactions, address, walletField, persistSession],
  );

  const demonstrateReplayBlock = useCallback(
    async (to: string, amount: string) => {
      if (!address || !proof) throw new Error('Connect wallet and generate proof first');
      try {
        await buildTransferTransaction(config, address, address, to, amount, proof);
        setReplayBlocked(false);
        setReplayMessage('Simulation succeeded unexpectedly — nullifier may not be spent yet.');
      } catch (err) {
        const raw = err instanceof Error ? err.message : String(err);
        const msg = formatSorobanUserError(raw);
        setReplayBlocked(true);
        setReplayMessage(msg);
        if (address && walletField) {
          persistSession({
            address,
            walletField,
            replayBlocked: true,
            replayMessage: msg,
          });
        }
        pushActivity({
          kind: 'verify',
          title: 'Replay blocked',
          detail: msg,
          status: 'error',
        });
      }
    },
    [address, proof, config, walletField, persistSession, pushActivity],
  );

  const buildDisclosure = useCallback(
    (txHash?: string): DisclosurePack | null => {
      if (!address || !walletField || !credential || !proof) return null;
      if (!proofMatchesCredential(proof, credential)) return null;
      return buildDisclosurePack({
        walletAddress: address,
        walletField,
        policyKey,
        credential,
        proof,
        txHash: txHash ?? receiptTransactions.transfer,
      });
    },
    [address, walletField, credential, proof, policyKey, receiptTransactions.transfer],
  );

  const signAndSubmit = useCallback(
    async (xdr: string) => {
      const { signedTxXdr } = await kit.signTransaction(xdr, {
        networkPassphrase: config.networkPassphrase,
        address: address || undefined,
      });
      return submitSignedTransaction(config, signedTxXdr);
    },
    [kit, config, address],
  );

  const value: AppContextValue = {
    config,
    address,
    walletField,
    walletModuleId,
    walletModuleName,
    connecting,
    connect,
    disconnect,
    kit,
    credential,
    proof,
    pofProof,
    proofDurationSec,
    policyKey,
    selectedOfferingId,
    receiptTransactions,
    transferResult,
    replayBlocked,
    replayMessage,
    proofReceipt,
    receiptLoading,
    setCredential,
    setProof,
    setPofProof,
    generatePofProofForWallet,
    setPolicyKey,
    setSelectedOfferingId,
    requestCredential,
    buildDisclosure,
    refreshProofReceipt,
    recordTransferTx,
    recordVerifyTx,
    demonstrateReplayBlock,
    activity,
    pushActivity,
    signAndSubmit,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
