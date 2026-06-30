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
  fetchIssuerHealth,
  fetchRegistrySyncRoot,
  type DeploymentConfig,
  type IssuerCredentialResponse,
} from '../lib/config';
import type { ProofBundle } from '../lib/contracts';
import { appendActivity, loadActivity, type ActivityEntry } from '../lib/activity';
import { walletFieldFromAddress } from '../lib/utils';
import { currentSettlementOwner } from '../lib/settlementOwner';
import { generateProof, getProverEnvironmentStatus } from '../lib/prover';
import { subscribePasskeyBusy } from '../lib/passkeyCeremony';
import {
  clearLocalProofBindCache,
  isProofBoundLocally,
  markProofBoundLocally,
} from '../lib/proofBindCache';
import {
  buildTransferTransaction,
  buildBindSessionProofTransaction,
  formatSorobanUserError,
  readBalance,
  readSessionProofBound,
  sessionProofMatchesBound,
  isSessionProofBoundOnChain,
  submitSignedTransaction,
} from '../lib/contracts';
import {
  loadWalletSession,
  saveWalletSession,
  migrateLegacySession,
  loadLastWalletConnection,
  saveLastWalletConnection,
  clearLastWalletConnection,
  clearWalletSession,
  type WalletSession,
} from '../lib/session';
import {
  clearPasskeySession,
  linkPasskeySessionToWallet,
  loadPasskeySession,
  migrateWalletSessionToPasskey,
  savePasskeySession,
  type PasskeySession,
} from '../lib/passkeySession';
import { proofMatchesCredential } from '../lib/credentialProof';
import {
  deriveProofLifecycle,
  syncProofLifecycleOnChain,
  type ProofLifecycleState,
} from '../lib/proofLifecycle';
import { recoveryLog } from '../lib/proofRecovery';
import type { PolicyKey } from '../lib/policies';
import { buildDisclosurePack, buildDisclosurePackFromReceipt, type DisclosurePack } from '../lib/disclosure';
import { generatePofProof } from '../lib/pofProver';
import {
  buildProofReceipt,
  type ProofReceipt,
  type ProofReceiptTransactions,
  type ProofReceiptTransferResult,
} from '../lib/proofReceipt';
import {
  ASSET_SCOPES,
  credentialForScope,
  proofScopeMatches,
  type SettlementAsset,
} from '../lib/assetScope';
import { assertScopeNullifierAvailable, isScopeNullifierSpent, scopeNullifierSpentMessage } from '../lib/scopeNullifier';
import {
  ensureRegistryRootForWallet,
  registryRootMismatchMessage,
  waitForCredentialRootsReady,
} from '../lib/registrySync';
import {
  connectPersonalSmartAccount,
  assertSmartAccountReadyForSettlement,
  createPersonalSmartAccount,
  enableLumengateSession as installLumengateSession,
  getLumengateSessionStatus,
  hydrateSmartAccountPasskeyMetadata,
  isAssembledTransaction,
  isContractAddress,
  resolveLegacySmartAccountPolicyForUi,
  resolvePasskeySimulationSource,
  revokeLumengateSession as clearLumengateSession,
  submitSmartAccountOperation,
  submitWithLumengateSession,
  type SignableTransaction,
  type LumengateSessionStatus,
  type SmartAccountAssembledTransaction,
  type SmartAccountState,
} from '../lib/smartAccount';
import {
  readConfidentialEurcBalance,
  type ConfidentialEurcBalance,
} from '../lib/confidentialBalance';
import {
  buildFundSmartAccountEurcXdr,
  buildFundSmartAccountUsdcXdr,
  buildFundSmartAccountXlmXdr,
} from '../lib/smartAccountFunding';

type AppContextValue = {
  config: DeploymentConfig;
  address: string | null;
  walletField: string | null;
  walletModuleId: string | null;
  walletModuleName: string | null;
  smartAccount: SmartAccountState | null;
  settlementAddress: string | null;
  smartAccountCreating: boolean;
  smartAccountStale: boolean;
  createSmartAccount: () => Promise<SmartAccountState>;
  replaceSmartAccount: () => Promise<SmartAccountState>;
  ensureProofForAsset: (
    asset: SettlementAsset,
    onProgress?: (message: string) => void,
  ) => Promise<{
    proof: ProofBundle;
    credential: IssuerCredentialResponse;
  }>;
  isScopeSettlementAvailable: (asset: SettlementAsset) => Promise<boolean>;
  bindSessionProofIfNeeded: (proof: ProofBundle) => Promise<string | null>;
  confirmPassportEligibility: (
    asset?: SettlementAsset,
    onProgress?: (message: string) => void,
  ) => Promise<{ proof: ProofBundle; credential: IssuerCredentialResponse; bindHash: string | null }>;
  sessionProofBound: boolean | null;
  lumengateSessionStatus: LumengateSessionStatus | null;
  enableLumengateSession: () => Promise<LumengateSessionStatus>;
  revokeLumengateSession: () => Promise<void>;
  refreshLumengateSessionStatus: () => Promise<LumengateSessionStatus | null>;
  confidentialEurcBalance: ConfidentialEurcBalance | null;
  confidentialBalanceLoading: boolean;
  refreshConfidentialEurcBalance: () => Promise<ConfidentialEurcBalance | null>;
  passkeyBusy: boolean;
  proverReady: boolean;
  proverWarmupMessage: string | null;
  proverWarmupError: string | null;
  refreshSessionProofBound: (proof?: ProofBundle | null) => Promise<boolean>;
  fundSmartAccountUsdc: (amount: string) => Promise<string>;
  fundSmartAccountEurc: (amount: string) => Promise<string>;
  fundSmartAccountXlm: (amountXlm: string) => Promise<string>;
  connecting: boolean;
  connect: () => Promise<void>;
  /** Re-authenticate stored passkey session (presentation — calls connectPersonalSmartAccount). */
  signInWithPasskey: () => Promise<void>;
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
  setProof: (
    p: ProofBundle | null,
    durationSec?: number | null,
    credentialOverride?: IssuerCredentialResponse | null,
  ) => void;
  setPofProof: (p: ProofBundle | null) => void;
  generatePofProofForWallet: (threshold: bigint) => Promise<ProofBundle>;
  setPolicyKey: (key: PolicyKey) => void;
  setSelectedOfferingId: (id: string | null) => void;
  requestCredential: (
    policyKey?: PolicyKey,
    onProgress?: (stage: 'health' | 'registry' | 'issuing', message: string) => void,
  ) => Promise<IssuerCredentialResponse>;
  buildDisclosure: (txHash?: string) => DisclosurePack | null;
  refreshProofReceipt: (options?: RefreshProofReceiptOptions) => Promise<ProofReceipt | null>;
  recordTransferTx: (hash: string, result: ProofReceiptTransferResult) => Promise<ProofReceipt | null>;
  recordVerifyTx: (hash: string) => Promise<void>;
  verifyDuplicateBlock: (to: string, amount: string) => Promise<void>;
  activity: ActivityEntry[];
  pushActivity: (entry: Omit<ActivityEntry, 'id' | 'timestamp'>) => void;
  signAndSubmit: (tx: SignableTransaction) => Promise<string>;
  /** Passkey settlement: bind session proof (tx 1) then settlement (tx 2). */
  signAndSubmitSettlement: (
    settlementFrom: string,
    proof: ProofBundle,
    tx: SmartAccountAssembledTransaction,
    onPasskeyStep?: (step: 'bind' | 'settle', index: number, total: number) => void,
  ) => Promise<string>;
  passportActivated: boolean;
  setPassportActivated: (active: boolean) => void;
  proofLifecycle: ProofLifecycleState;
  syncProofLifecycle: () => Promise<void>;
  consumedTxHash: string | null;
  beginProofRecovery: () => void;
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
  const [smartAccount, setSmartAccount] = useState<SmartAccountState | null>(null);
  const [smartAccountCreating, setSmartAccountCreating] = useState(false);
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
  const [passportActivated, setPassportActivatedState] = useState(false);
  const [consumedTxHash, setConsumedTxHash] = useState<string | null>(null);
  const [proofLifecycle, setProofLifecycle] = useState<ProofLifecycleState>({
    lifecycle: 'none',
    consumedTxHash: null,
    reason: null,
  });
  const [activity, setActivity] = useState<ActivityEntry[]>(() => loadActivity());
  const settlementAddress = smartAccount?.smartAccountAddress ?? null;
  const [smartAccountStale, setSmartAccountStale] = useState(false);
  const [sessionProofBound, setSessionProofBound] = useState<boolean | null>(null);
  const [lumengateSessionStatus, setLumengateSessionStatus] = useState<LumengateSessionStatus | null>(null);
  const [confidentialEurcBalance, setConfidentialEurcBalance] = useState<ConfidentialEurcBalance | null>(null);
  const [confidentialBalanceLoading, setConfidentialBalanceLoading] = useState(false);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [proverReady, setProverReady] = useState(false);
  const [proverWarmupMessage, setProverWarmupMessage] = useState<string | null>(null);
  const [proverWarmupError, setProverWarmupError] = useState<string | null>(null);

  const refreshSessionProofBound = useCallback(
    async (proofBundle?: ProofBundle | null): Promise<boolean> => {
      const candidate = proofBundle ?? proof;
      if (!settlementAddress || !config.sessionStoreId || !candidate) {
        setSessionProofBound(null);
        return false;
      }
      const bound = await isSessionProofBoundOnChain(config, settlementAddress, candidate);
      setSessionProofBound(bound);
      return bound;
    },
    [config, settlementAddress, proof],
  );

  useEffect(() => {
    return subscribePasskeyBusy(setPasskeyBusy);
  }, []);

  useEffect(() => {
    if (!proof || !settlementAddress) {
      setSessionProofBound(null);
      return;
    }
    void refreshSessionProofBound(proof);
  }, [proof, settlementAddress, refreshSessionProofBound]);

  useEffect(() => {
    let cancelled = false;
    if (!smartAccount) {
      setSmartAccountStale(false);
      return;
    }
    void resolveLegacySmartAccountPolicyForUi(config, smartAccount)
      .then((legacy) => {
        if (!cancelled) setSmartAccountStale(legacy);
      })
      .catch(() => {
        if (!cancelled) setSmartAccountStale(false);
      });
    return () => {
      cancelled = true;
    };
  }, [smartAccount, config]);

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
        smartAccount:
          partial.smartAccount !== undefined ? partial.smartAccount : (existing?.smartAccount ?? null),
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
        proofReceipt:
          partial.proofReceipt !== undefined
            ? partial.proofReceipt
            : (existing?.proofReceipt ?? null),
        passportActivated:
          partial.passportActivated !== undefined
            ? partial.passportActivated
            : (existing?.passportActivated ?? false),
        proofLifecycle: partial.proofLifecycle ?? existing?.proofLifecycle,
        consumedTxHash:
          partial.consumedTxHash !== undefined
            ? partial.consumedTxHash
            : (existing?.consumedTxHash ?? null),
        updatedAt: Date.now(),
      };
      saveWalletSession(next);
    },
    [],
  );

  const persistPasskeySession = useCallback(
    (partial: Partial<PasskeySession> & { smartAccountAddress: string; walletField: string; smartAccount: SmartAccountState }) => {
      const existing = loadPasskeySession();
      const next: PasskeySession = {
        smartAccountAddress: partial.smartAccountAddress,
        walletField: partial.walletField,
        smartAccount: partial.smartAccount,
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
        proofReceipt:
          partial.proofReceipt !== undefined
            ? partial.proofReceipt
            : (existing?.proofReceipt ?? null),
        settlementProofArchive:
          partial.settlementProofArchive !== undefined
            ? partial.settlementProofArchive
            : (existing?.settlementProofArchive ?? null),
        passportActivated:
          partial.passportActivated !== undefined
            ? partial.passportActivated
            : (existing?.passportActivated ?? false),
        proofLifecycle: partial.proofLifecycle ?? existing?.proofLifecycle,
        consumedTxHash:
          partial.consumedTxHash !== undefined
            ? partial.consumedTxHash
            : (existing?.consumedTxHash ?? null),
        fundingWalletAddress: partial.fundingWalletAddress ?? existing?.fundingWalletAddress ?? null,
        updatedAt: Date.now(),
      };
      savePasskeySession(next);
    },
    [],
  );

  const persistReceiptState = useCallback(
    (partial: {
      receiptTransactions?: ProofReceiptTransactions;
      transferResult?: ProofReceiptTransferResult | null;
      proofReceipt?: ProofReceipt | null;
      settlementProofArchive?: ProofBundle | null;
      proof?: ProofBundle | null;
      consumedTxHash?: string | null;
      proofLifecycle?: PasskeySession['proofLifecycle'];
      passportActivated?: boolean;
    }) => {
      if (address && walletField) {
        persistSession({ address, walletField, ...partial });
      }
      if (smartAccount && walletField) {
        persistPasskeySession({
          smartAccountAddress: smartAccount.smartAccountAddress,
          walletField,
          smartAccount,
          ...partial,
        });
      }
    },
    [address, walletField, smartAccount, persistSession, persistPasskeySession],
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
    setSmartAccount(saved.smartAccount ?? null);
    setReceiptTransactions(saved.receiptTransactions ?? emptyReceiptTxs);
    setTransferResult(saved.transferResult ?? null);
    setReplayBlocked(saved.replayBlocked ?? false);
    setReplayMessage(saved.replayMessage ?? null);
    setProofReceipt(saved.proofReceipt ?? null);
    setPassportActivatedState(saved.passportActivated ?? false);
    setConsumedTxHash(saved.consumedTxHash ?? null);
    setProofLifecycle(
      saved.proofLifecycle
        ? {
            lifecycle: saved.proofLifecycle,
            consumedTxHash: saved.consumedTxHash ?? null,
            reason:
              saved.proofLifecycle === 'consumed'
                ? 'Passport used by a previous settlement.'
                : saved.proofLifecycle === 'invalid'
                  ? 'Eligibility confirmation does not match current passport — confirm again.'
                  : null,
          }
        : deriveProofLifecycle(
            saved.credential,
            proofOk ? saved.proof : null,
            saved.consumedTxHash ?? null,
          ),
    );
    if (saved.walletModuleId) {
      kit.setWallet(saved.walletModuleId);
    }
  }, [kit]);

  const applyPasskeySession = useCallback(
    (saved: PasskeySession) => {
      setWalletField(saved.walletField);
      setAddress(saved.fundingWalletAddress ?? null);
      applySession({
        address: saved.fundingWalletAddress ?? '',
        walletField: saved.walletField,
        smartAccount: saved.smartAccount,
        credential: saved.credential,
        proof: saved.proof,
        pofProof: saved.pofProof,
        proofDurationSec: saved.proofDurationSec,
        policyKey: saved.policyKey,
        selectedOfferingId: saved.selectedOfferingId,
        receiptTransactions: saved.receiptTransactions,
        transferResult: saved.transferResult,
        replayBlocked: saved.replayBlocked,
        replayMessage: saved.replayMessage,
        proofReceipt: saved.proofReceipt,
        passportActivated: saved.passportActivated,
        proofLifecycle: saved.proofLifecycle,
        consumedTxHash: saved.consumedTxHash,
        updatedAt: saved.updatedAt,
      });
    },
    [applySession],
  );

  const restoreSession = useCallback(
    (addr: string) => {
      let saved = loadWalletSession(addr);
      if (!saved) saved = migrateLegacySession(addr);
      if (!saved || saved.address !== addr) return;
      setWalletField(saved.walletField);
      applySession(saved);
    },
    [applySession],
  );

  useEffect(() => {
    let cancelled = false;
    setProverReady(true);
    setProverWarmupError(null);
    setProverWarmupMessage(null);
    getProverEnvironmentStatus()
      .then((status) => {
        if (!cancelled) {
          setProverReady(status.ready);
          setProverWarmupMessage(null);
          setProverWarmupError(
            status.ready
              ? null
              : 'Private proofs require cross-origin isolation (COOP/COEP) and SharedArrayBuffer support.',
          );
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setProverReady(false);
          setProverWarmupError(err instanceof Error ? err.message : String(err));
          setProverWarmupMessage(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!smartAccount || !walletField) return;
    let cancelled = false;
    hydrateSmartAccountPasskeyMetadata(config, smartAccount)
      .then((hydrated) => {
        if (cancelled) return;
        if (
          hydrated.passkeyKeyDataHex === smartAccount.passkeyKeyDataHex &&
          hydrated.passkeyPublicKey === smartAccount.passkeyPublicKey
        ) {
          return;
        }
        setSmartAccount(hydrated);
        if (address) {
          persistSession({ address, walletField, smartAccount: hydrated });
        } else {
          persistPasskeySession({
            smartAccountAddress: hydrated.smartAccountAddress,
            walletField,
            smartAccount: hydrated,
          });
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [
    smartAccount?.smartAccountAddress,
    smartAccount?.credentialId,
    smartAccount?.passkeyKeyDataHex,
    smartAccount?.passkeyPublicKey,
    address,
    walletField,
    config,
    persistSession,
    persistPasskeySession,
  ]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const passkeySaved = loadPasskeySession();
      if (passkeySaved) {
        applyPasskeySession(passkeySaved);
      }

      const last = loadLastWalletConnection();
      if (last) {
        setAddress(last.address);
        if (!passkeySaved) {
          setWalletField(last.walletField);
          restoreSession(last.address);
        } else {
          const walletSaved = loadWalletSession(last.address);
          if (walletSaved?.walletModuleId) {
            setWalletModuleId(walletSaved.walletModuleId);
            setWalletModuleName(walletSaved.walletModuleName ?? null);
            kit.setWallet(walletSaved.walletModuleId);
          }
        }
        return;
      }
      try {
        const { address: addr } = await kit.getAddress({ skipRequestAccess: true });
        const wf = await walletFieldFromAddress(addr);
        if (cancelled) return;
        setAddress(addr);
        if (!passkeySaved) {
          setWalletField(wf);
          restoreSession(addr);
        }
        saveLastWalletConnection({
          address: addr,
          walletField: passkeySaved?.walletField ?? wf,
        });
      } catch {
        /* extension not auto-connected — passkey session may still restore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [kit, restoreSession, applyPasskeySession]);

  const syncProofLifecycle = useCallback(async () => {
    const settlementTx = consumedTxHash;
    const synced = await syncProofLifecycleOnChain(config, credential, proof, settlementTx);
    setProofLifecycle(synced);
    if (synced.lifecycle === 'consumed') {
      if (synced.consumedTxHash) setConsumedTxHash(synced.consumedTxHash);
      if (proof) setProofState(null);
    } else if (synced.lifecycle === 'none' || synced.lifecycle === 'ready') {
      if (!synced.consumedTxHash) setConsumedTxHash(null);
    }
    if (address && walletField) {
      persistSession({
        address,
        walletField,
        proofLifecycle: synced.lifecycle,
        consumedTxHash: synced.lifecycle === 'consumed' ? synced.consumedTxHash : null,
        proof: synced.lifecycle === 'ready' ? proof : synced.lifecycle === 'consumed' ? null : proof,
      });
    }
  }, [config, credential, proof, consumedTxHash, address, walletField, persistSession]);

  useEffect(() => {
    if (!credential && !proof) {
      setProofLifecycle({ lifecycle: 'none', consumedTxHash: null, reason: null });
      return;
    }
    syncProofLifecycle().catch(() => undefined);
  }, [credential, proof, syncProofLifecycle]);

  useEffect(() => {
    if (!credential || !proof) return;
    if (!proofMatchesCredential(proof, credential)) {
      setProofState(null);
      setProofDurationSec(null);
    }
  }, [credential, proof]);

  const refreshProofReceipt = useCallback(
    async (overrides?: RefreshProofReceiptOptions): Promise<ProofReceipt | null> => {
      const ownerAddress = currentSettlementOwner(config, address, settlementAddress);
      if (!ownerAddress || !walletField || !credential) {
        if (!proofReceipt?.transactions.transfer) {
          setProofReceipt(null);
        }
        return proofReceipt?.transactions.transfer ? proofReceipt : null;
      }

      const archivedProof = loadPasskeySession()?.settlementProofArchive ?? null;
      const effectiveProof =
        proof && proofMatchesCredential(proof, credential)
          ? proof
          : archivedProof && proofMatchesCredential(archivedProof, credential)
            ? archivedProof
            : null;

      if (!effectiveProof) {
        if (proofReceipt?.transactions.transfer) {
          return proofReceipt;
        }
        setProofReceipt(null);
        return null;
      }

      setReceiptLoading(true);
      try {
        const receipt = await buildProofReceipt({
          config,
          address: ownerAddress,
          walletField,
          walletModuleId: walletModuleId ?? undefined,
          walletModuleName: walletModuleName ?? undefined,
          policyKey,
          credential,
          proof: effectiveProof,
          transactions: overrides?.transactions ?? receiptTransactions,
          transferResult: overrides?.transferResult ?? transferResult ?? undefined,
          replayBlocked: overrides?.replayBlocked ?? replayBlocked,
          replayMessage: overrides?.replayMessage ?? replayMessage ?? undefined,
        });
        setProofReceipt(receipt);
        if (receipt) {
          persistReceiptState({ proofReceipt: receipt });
        }
        return receipt;
      } finally {
        setReceiptLoading(false);
      }
    },
    [
      address,
      settlementAddress,
      walletField,
      walletModuleId,
      walletModuleName,
      credential,
      proof,
      proofReceipt,
      policyKey,
      config,
      receiptTransactions,
      transferResult,
      replayBlocked,
      replayMessage,
      persistReceiptState,
    ],
  );

  useEffect(() => {
    const ownerAddress = currentSettlementOwner(config, address, settlementAddress);
    if (!ownerAddress || !credential) {
      return;
    }
    if (proofReceipt?.transactions.transfer) {
      return;
    }
    const hasTransferData = Boolean(receiptTransactions.transfer || transferResult);
    const hasProof = Boolean(
      proof ||
        (loadPasskeySession()?.settlementProofArchive &&
          proofMatchesCredential(loadPasskeySession()!.settlementProofArchive!, credential)),
    );
    if (hasTransferData && hasProof) {
      refreshProofReceipt().catch(() => undefined);
      return;
    }
    if (proof && proofMatchesCredential(proof, credential)) {
      refreshProofReceipt().catch(() => undefined);
    }
  }, [
    address,
    settlementAddress,
    proof,
    credential,
    receiptTransactions,
    transferResult,
    proofReceipt,
    refreshProofReceipt,
    config,
  ]);

  useEffect(() => {
    if (transferResult || receiptTransactions.transfer || proofReceipt?.transactions.transfer) {
      return;
    }
    const ownerAddress = currentSettlementOwner(config, address, settlementAddress);
    if (!ownerAddress || !walletField) return;

    const entry = activity.find((e) => e.kind === 'transfer' && e.status === 'success' && e.txHash);
    if (!entry?.txHash) return;

    const amountMatch = entry.title.match(/:\s*([\d.]+)/);
    const detailMatch = entry.detail?.match(/^([\d.]+)\s+(\S+)\s+→\s*(.+)$/);
    const amount = amountMatch?.[1] ?? detailMatch?.[1] ?? '';
    const to = detailMatch?.[3]?.trim() ?? config.marketplaceSettlementAddress;
    const recovered: ProofReceiptTransferResult = {
      from: ownerAddress,
      to,
      amount,
      success: true,
    };
    const txs = { ...receiptTransactions, transfer: entry.txHash };
    setReceiptTransactions(txs);
    setTransferResult(recovered);
    persistReceiptState({
      receiptTransactions: txs,
      transferResult: recovered,
    });
    refreshProofReceipt({
      transactions: txs,
      transferResult: recovered,
    }).catch(() => undefined);
  }, [
    activity,
    address,
    settlementAddress,
    walletField,
    transferResult,
    receiptTransactions,
    proofReceipt,
    config,
    persistReceiptState,
    refreshProofReceipt,
  ]);

  useEffect(() => {
    if (!walletField) return;
    const ownerAddress = currentSettlementOwner(config, address, settlementAddress);
    if (!ownerAddress) return;

    if (address && walletField) {
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
        smartAccount,
        receiptTransactions,
        transferResult,
        proofReceipt,
        replayBlocked,
        replayMessage,
        passportActivated,
        consumedTxHash,
        proofLifecycle: proofLifecycle.lifecycle,
      });
    }
    if (smartAccount && walletField) {
      persistPasskeySession({
        smartAccountAddress: smartAccount.smartAccountAddress,
        walletField,
        smartAccount,
        credential,
        proof,
        pofProof,
        proofDurationSec,
        policyKey,
        selectedOfferingId,
        receiptTransactions,
        transferResult,
        proofReceipt,
        replayBlocked,
        replayMessage,
        passportActivated,
        consumedTxHash,
        proofLifecycle: proofLifecycle.lifecycle,
      });
    }
  }, [
    address,
    settlementAddress,
    walletField,
    credential,
    proof,
    proofDurationSec,
    policyKey,
    selectedOfferingId,
    pofProof,
    walletModuleId,
    walletModuleName,
    smartAccount,
    receiptTransactions,
    transferResult,
    proofReceipt,
    replayBlocked,
    replayMessage,
    passportActivated,
    consumedTxHash,
    proofLifecycle,
    persistSession,
    persistPasskeySession,
    config,
  ]);

  const pushActivity = useCallback((entry: Omit<ActivityEntry, 'id' | 'timestamp'>) => {
    setActivity(appendActivity(entry));
  }, []);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      const walletRef: { current: ISupportedWallet | null } = { current: null };
      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const finish = (fn: () => void) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timeout);
          fn();
        };
        const timeout = window.setTimeout(() => {
          finish(() => reject(new Error('No wallet responded. Install or unlock Freighter, xBull, Albedo, LOBSTR, or Hana and try again.')));
        }, 15_000);
        kit.openModal({
          modalTitle: 'Connect a Wallet',
          onWalletSelected: (option) => {
            walletRef.current = option;
            kit.setWallet(option.id);
            finish(resolve);
          },
          onClosed: (err) => {
            finish(() => {
              if (err) reject(err);
              else reject(new Error('Wallet connection closed'));
            });
          },
        });
      });
      const selected = walletRef.current;
      const { address: addr } = await kit.getAddress();
      const fundingField = await walletFieldFromAddress(addr);
      const passkeySaved = loadPasskeySession();
      setAddress(addr);
      setWalletModuleId(selected?.id ?? null);
      setWalletModuleName(selected?.name ?? null);

      if (passkeySaved) {
        const merged = linkPasskeySessionToWallet(addr, fundingField);
        if (merged) {
          setWalletField(merged.walletField);
          applySession(merged);
        }
      } else {
        setWalletField(fundingField);
        restoreSession(addr);
        saveLastWalletConnection({
          address: addr,
          walletField: fundingField,
          walletModuleId: selected?.id,
          walletModuleName: selected?.name,
        });
        persistSession({
          address: addr,
          walletField: fundingField,
          walletModuleId: selected?.id,
          walletModuleName: selected?.name,
        });
      }

      if (passkeySaved) {
        saveLastWalletConnection({
          address: addr,
          walletField: passkeySaved.walletField,
          walletModuleId: selected?.id,
          walletModuleName: selected?.name,
        });
        persistPasskeySession({
          ...passkeySaved,
          smartAccountAddress: passkeySaved.smartAccountAddress,
          walletField: passkeySaved.walletField,
          smartAccount: passkeySaved.smartAccount,
          fundingWalletAddress: addr,
        });
      }
      pushActivity({
        kind: 'verify',
        title: 'Wallet connected',
        detail: selected?.name ? `${selected.name} · ${addr}` : addr,
        status: 'success',
      });
    } finally {
      setConnecting(false);
    }
  }, [kit, pushActivity, restoreSession, persistSession, persistPasskeySession, applySession]);

  const signInWithPasskey = useCallback(async () => {
    const saved = loadPasskeySession();
    if (!saved?.smartAccount) {
      throw new Error('No saved Lumengate account on this device.');
    }
    setConnecting(true);
    try {
      await connectPersonalSmartAccount(config, saved.smartAccount);
      applyPasskeySession(saved);
      pushActivity({
        kind: 'verify',
        title: 'Signed in',
        detail: `${saved.smartAccountAddress.slice(0, 8)}…`,
        status: 'success',
      });
    } finally {
      setConnecting(false);
    }
  }, [config, applyPasskeySession, pushActivity]);

  const disconnect = useCallback(() => {
    kit.disconnect().catch(() => undefined);
    const walletAddr = address;
    const walletSession = walletAddr ? loadWalletSession(walletAddr) : null;
    if (walletAddr) clearWalletSession(walletAddr);
    clearLastWalletConnection();
    setAddress(null);
    setWalletModuleId(null);
    setWalletModuleName(null);

    let passkeySaved = loadPasskeySession();
    if (!passkeySaved && walletSession?.smartAccount && walletSession.walletField) {
      passkeySaved = migrateWalletSessionToPasskey(walletSession);
    }

    if (passkeySaved) {
      applyPasskeySession({ ...passkeySaved, fundingWalletAddress: null });
      return;
    }

    clearPasskeySession();
    setWalletField(null);
    setSmartAccount(null);
    setCredentialState(null);
    setProofState(null);
    setProofDurationSec(null);
    setProofReceipt(null);
    setPassportActivatedState(false);
    setConsumedTxHash(null);
    setProofLifecycle({ lifecycle: 'none', consumedTxHash: null, reason: null });
  }, [kit, address, applyPasskeySession]);

  const createSmartAccount = useCallback(async (): Promise<SmartAccountState> => {
    const canDeployWithoutWallet = config.passkeyOnlyDeployEnabled;
    if (!address && !canDeployWithoutWallet) {
      throw new Error('Connect wallet first to pay deploy fees, or configure the OpenZeppelin relayer.');
    }
    setSmartAccountCreating(true);
    try {
      const deploySeed = address ?? crypto.randomUUID();
      const created = await createPersonalSmartAccount(config, deploySeed);
      const issuerField = await walletFieldFromAddress(created.smartAccountAddress);
      setSmartAccount(created);
      setWalletField(issuerField);

      if (address) {
        persistSession({
          address,
          walletField: issuerField,
          smartAccount: created,
        });
        persistPasskeySession({
          smartAccountAddress: created.smartAccountAddress,
          walletField: issuerField,
          smartAccount: created,
          fundingWalletAddress: address,
        });
      } else {
        persistPasskeySession({
          smartAccountAddress: created.smartAccountAddress,
          walletField: issuerField,
          smartAccount: created,
        });
      }
      pushActivity({
        kind: 'verify',
        title: 'Smart account ready',
        detail: created.smartAccountAddress,
        status: 'success',
      });
      return created;
    } finally {
      setSmartAccountCreating(false);
    }
  }, [address, config, persistSession, persistPasskeySession, pushActivity]);

  const replaceSmartAccount = useCallback(async (): Promise<SmartAccountState> => {
    const issuerField =
      walletField ??
      (settlementAddress ? await walletFieldFromAddress(settlementAddress) : null);
    if (!address && !issuerField) throw new Error('Create or restore your passkey account first');
    setSmartAccount(null);
    setProofState(null);
    setProofDurationSec(null);
    setProofLifecycle({ lifecycle: 'none', consumedTxHash: null, reason: null });
    if (address && issuerField) {
      persistSession({
        address,
        walletField: issuerField,
        smartAccount: null,
        proof: null,
        proofDurationSec: null,
        proofLifecycle: 'none',
      });
    } else if (settlementAddress && issuerField && smartAccount) {
      persistPasskeySession({
        smartAccountAddress: settlementAddress,
        walletField: issuerField,
        smartAccount,
        proof: null,
        proofDurationSec: null,
        proofLifecycle: 'none',
      });
    }
    return createSmartAccount();
  }, [address, walletField, settlementAddress, smartAccount, persistSession, persistPasskeySession, createSmartAccount]);

  const setCredential = useCallback((c: IssuerCredentialResponse | null) => {
    setCredentialState(c);
    if (!c) {
      setProofState(null);
      setPofProofState(null);
      setProofDurationSec(null);
      setReceiptTransactions(emptyReceiptTxs);
      setTransferResult(null);
      setProofReceipt(null);
      setPassportActivatedState(false);
      setConsumedTxHash(null);
      setProofLifecycle({ lifecycle: 'none', consumedTxHash: null, reason: null });
      if (address && walletField) {
        persistSession({
          address,
          walletField,
          credential: null,
          proof: null,
          pofProof: null,
          proofDurationSec: null,
          receiptTransactions: emptyReceiptTxs,
          transferResult: null,
          proofReceipt: null,
          passportActivated: false,
          consumedTxHash: null,
          proofLifecycle: 'none',
        });
      }
    }
  }, [address, walletField, persistSession]);

  const setPolicyKey = useCallback((key: PolicyKey) => {
    setPolicyKeyState(key);
  }, []);

  const setSelectedOfferingId = useCallback((id: string | null) => {
    setSelectedOfferingIdState(id);
  }, []);

  const requestCredential = useCallback(
    async (
      requestedPolicyKey?: PolicyKey,
      onProgress?: (stage: 'health' | 'registry' | 'issuing', message: string) => void,
    ) => {
      const issuerField =
        walletField ??
        (settlementAddress ? await walletFieldFromAddress(settlementAddress) : null);
      if (!issuerField) throw new Error('Create your passkey account first');
      const pk = requestedPolicyKey ?? policyKey;

      onProgress?.('health', 'Connecting to Lumengate issuer…');
      await fetchIssuerHealth(config.issuerServiceUrl);

      onProgress?.('registry', 'Syncing eligibility registry on Stellar…');
      await fetchRegistrySyncRoot(config.issuerServiceUrl, issuerField, pk);

      onProgress?.('issuing', 'Issuing your private passport…');
      const cred = await fetchIssuerCredential(config.issuerServiceUrl, issuerField, pk);
      setPolicyKeyState(pk);
      setWalletField(issuerField);
      setCredentialState(cred);
      setProofState(null);
      setPofProofState(null);
      setProofDurationSec(null);
      setConsumedTxHash(null);
      setPassportActivatedState(false);
      setProofLifecycle({ lifecycle: 'none', consumedTxHash: null, reason: null });

      if (address) {
        persistSession({
          address,
          walletField: issuerField,
          credential: cred,
          proof: null,
          pofProof: null,
          proofDurationSec: null,
          policyKey: pk,
          selectedOfferingId,
          consumedTxHash: null,
          passportActivated: false,
          proofLifecycle: 'none',
        });
      }
      if (smartAccount) {
        persistPasskeySession({
          smartAccountAddress: smartAccount.smartAccountAddress,
          walletField: issuerField,
          smartAccount,
          credential: cred,
          proof: null,
          pofProof: null,
          proofDurationSec: null,
          policyKey: pk,
          selectedOfferingId,
          consumedTxHash: null,
          passportActivated: false,
          proofLifecycle: 'none',
          fundingWalletAddress: address,
        });
      }
      const synced = await syncProofLifecycleOnChain(config, cred, null, null);
      setProofLifecycle(synced);
      pushActivity({
        kind: 'credential',
        title: 'Passport received',
        detail: cred.label,
        status: 'info',
      });
      return cred;
    },
    [config.issuerServiceUrl, config, walletField, settlementAddress, smartAccount, address, policyKey, selectedOfferingId, pushActivity, persistSession, persistPasskeySession],
  );

  const setProof = useCallback(
    (
      p: ProofBundle | null,
      durationSec?: number | null,
      credentialOverride?: IssuerCredentialResponse | null,
    ) => {
      const proofCredential =
        credentialOverride !== undefined ? credentialOverride : credential;
      if (credentialOverride !== undefined) {
        setCredentialState(credentialOverride);
      }
      setProofState(p);
      const duration = durationSec ?? null;
      setProofDurationSec(duration);
      const nextLifecycle = p ? deriveProofLifecycle(proofCredential, p, null) : proofLifecycle;
      if (p) {
        clearLocalProofBindCache();
        setSessionProofBound(false);
        setReceiptTransactions(emptyReceiptTxs);
        setTransferResult(null);
        setReplayBlocked(false);
        setReplayMessage(null);
        setProofReceipt(null);
        setConsumedTxHash(null);
        setProofLifecycle(nextLifecycle);
      }
      if (smartAccount && walletField) {
        persistPasskeySession({
          smartAccountAddress: smartAccount.smartAccountAddress,
          walletField,
          smartAccount,
          credential: proofCredential,
          proof: p,
          proofDurationSec: duration,
          policyKey,
          selectedOfferingId,
          receiptTransactions: p ? emptyReceiptTxs : receiptTransactions,
          transferResult: p ? null : transferResult,
          replayBlocked: p ? false : replayBlocked,
          replayMessage: p ? null : replayMessage,
          consumedTxHash: p ? null : consumedTxHash,
          proofLifecycle: p ? nextLifecycle.lifecycle : proofLifecycle.lifecycle,
          fundingWalletAddress: address,
        });
      }
      if (address && walletField) {
        persistSession({
          address,
          walletField,
          credential: proofCredential,
          proof: p,
          pofProof,
          proofDurationSec: duration,
          policyKey,
          selectedOfferingId,
          receiptTransactions: p ? emptyReceiptTxs : receiptTransactions,
          transferResult: p ? null : transferResult,
          replayBlocked: p ? false : replayBlocked,
          replayMessage: p ? null : replayMessage,
          consumedTxHash: p ? null : consumedTxHash,
          proofLifecycle: p ? nextLifecycle.lifecycle : proofLifecycle.lifecycle,
        });
      }
    },
    [
      address,
      walletField,
      credential,
      smartAccount,
      address,
      policyKey,
      selectedOfferingId,
      pofProof,
      persistSession,
      persistPasskeySession,
      receiptTransactions,
      transferResult,
      replayBlocked,
      replayMessage,
      consumedTxHash,
      proofLifecycle,
    ],
  );

  const bindSessionProofIfNeeded = useCallback(
    async (proofBundle: ProofBundle): Promise<string | null> => {
      if (!smartAccount || !settlementAddress || !config.sessionStoreId) {
        throw new Error('Create your passkey smart account before authorizing eligibility.');
      }
      if (!isContractAddress(settlementAddress)) {
        throw new Error('Session proof bind requires a smart account address.');
      }
      const alreadyBound =
        isProofBoundLocally(proofBundle) ||
        (await isSessionProofBoundOnChain(config, settlementAddress, proofBundle));
      if (alreadyBound) {
        setSessionProofBound(true);
        markProofBoundLocally(proofBundle);
        return null;
      }
      const bindSource = resolvePasskeySimulationSource(address);
      const bindTx = await buildBindSessionProofTransaction(
        config,
        bindSource,
        settlementAddress,
        proofBundle,
      );
      let bindHash: string;
      bindHash = await submitSmartAccountOperation(config, smartAccount, bindTx, { forceMethod: 'rpc' });
      setSessionProofBound(true);
      markProofBoundLocally(proofBundle);
      setReceiptTransactions((prev) => {
        const txs = { ...prev, sessionBind: bindHash };
        if (address && walletField) {
          persistSession({ address, walletField, receiptTransactions: txs });
        } else if (smartAccount && walletField) {
          persistPasskeySession({
            smartAccountAddress: smartAccount.smartAccountAddress,
            walletField,
            smartAccount,
            receiptTransactions: txs,
          });
        }
        return txs;
      });
      pushActivity({
        kind: 'proof',
        title: 'Passkey authorized',
        detail: 'Session proof bound on-chain for settlement',
        txHash: bindHash,
        status: 'success',
      });
      return bindHash;
    },
    [config, smartAccount, settlementAddress, address, walletField, persistSession, persistPasskeySession, pushActivity],
  );

  const refreshLumengateSessionStatus = useCallback(async (): Promise<LumengateSessionStatus | null> => {
    if (!smartAccount) {
      setLumengateSessionStatus(null);
      return null;
    }
    const status = await getLumengateSessionStatus(config, smartAccount).catch(() => null);
    setLumengateSessionStatus(status);
    return status;
  }, [config, smartAccount]);

  useEffect(() => {
    void refreshLumengateSessionStatus();
  }, [refreshLumengateSessionStatus]);

  const refreshConfidentialEurcBalance = useCallback(async (): Promise<ConfidentialEurcBalance | null> => {
    if (!settlementAddress || !config.confidentialTokenId) {
      setConfidentialEurcBalance(null);
      return null;
    }
    setConfidentialBalanceLoading(true);
    try {
      const balance = await readConfidentialEurcBalance(config, settlementAddress);
      setConfidentialEurcBalance(balance);
      return balance;
    } catch {
      setConfidentialEurcBalance(null);
      return null;
    } finally {
      setConfidentialBalanceLoading(false);
    }
  }, [config, settlementAddress]);

  useEffect(() => {
    void refreshConfidentialEurcBalance();
  }, [refreshConfidentialEurcBalance]);

  const enableLumengateSession = useCallback(async (): Promise<LumengateSessionStatus> => {
    if (!smartAccount) {
      throw new Error('Create your passkey smart account before enabling a Lumengate session.');
    }
    const status = await installLumengateSession(config, smartAccount);
    setLumengateSessionStatus(status);
    pushActivity({
      kind: 'proof',
      title: '7-day session enabled',
      detail: status.enabled
        ? 'Delegated Lumengate session rules installed on-chain'
        : `${status.installedContracts.length} session rules installed; ${status.missingContracts.length} missing`,
      status: status.enabled ? 'success' : 'info',
    });
    return status;
  }, [config, smartAccount, pushActivity]);

  const revokeLumengateSession = useCallback(async (): Promise<void> => {
    if (!smartAccount) return;
    clearLumengateSession(smartAccount.smartAccountAddress);
    const status = await refreshLumengateSessionStatus();
    pushActivity({
      kind: 'proof',
      title: 'Trusted device session revoked',
      detail: status?.enabled
        ? 'Local session key cleared; on-chain rules expire at ledger deadline'
        : 'Local session key cleared',
      status: 'info',
    });
  }, [smartAccount, refreshLumengateSessionStatus, pushActivity]);

  const confirmPassportEligibility = useCallback(
    async (
      asset: SettlementAsset = 'rwa',
      onProgress?: (message: string) => void,
    ): Promise<{ proof: ProofBundle; credential: IssuerCredentialResponse; bindHash: string | null }> => {
      if (!credential) {
        throw new Error('Request a passport before confirming eligibility.');
      }
      if (!smartAccount || !settlementAddress) {
        throw new Error('Create your passkey smart account before confirming eligibility.');
      }
      const scope = ASSET_SCOPES[asset];
      await assertScopeNullifierAvailable(config, credential, asset);
      onProgress?.('Confirming eligibility registry on-chain…');
      let activeCredential = credential;
      if (walletField) {
        const syncResult = await ensureRegistryRootForWallet(
          config.issuerServiceUrl,
          walletField,
          policyKey,
        ).catch(() => null);
        if (syncResult?.root) {
          activeCredential = {
            ...activeCredential,
            credential: { ...activeCredential.credential, root: syncResult.root },
          };
          setCredentialState(activeCredential);
          if (address) {
            persistSession({ address, walletField, credential: activeCredential });
          }
        }
      }
      const rootsReady = await waitForCredentialRootsReady(config, activeCredential, proof, onProgress);
      if (!rootsReady) {
        throw new Error(registryRootMismatchMessage());
      }
      const scopedCredential = credentialForScope(activeCredential, scope);
      onProgress?.('Generating private proof in your browser (~30s)…');
      const { bundle, durationSec } = await generateProof(scopedCredential, (p) => {
        onProgress?.(p.message);
      });
      setProof(bundle, durationSec, scopedCredential);
      clearLocalProofBindCache();
      setSessionProofBound(false);
      pushActivity({
        kind: 'proof',
        title: `${asset === 'rwa' ? 'Eligibility' : asset.toUpperCase()} confirmed`,
        detail: 'Private passport generated locally — authorize with passkey when ready',
        status: 'success',
      });
      return { proof: bundle, credential: scopedCredential, bindHash: null };
    },
    [
      credential,
      smartAccount,
      settlementAddress,
      config,
      setProof,
      pushActivity,
      walletField,
      policyKey,
      proof,
      address,
      persistSession,
    ],
  );

  const ensureProofForAsset = useCallback(
    async (
      asset: SettlementAsset,
      onProgress?: (message: string) => void,
    ): Promise<{ proof: ProofBundle; credential: IssuerCredentialResponse }> => {
      const scope = ASSET_SCOPES[asset];
      if (!credential) throw new Error('Request a passport before settlement');
      await assertScopeNullifierAvailable(config, credential, asset);
      if (proof && credential && proofMatchesCredential(proof, credential) && proofScopeMatches(proof, scope)) {
        const spent = await isScopeNullifierSpent(config, credential, scope);
        if (spent) {
          setProofState(null);
          setSessionProofBound(false);
          clearLocalProofBindCache();
          throw new Error(scopeNullifierSpentMessage(asset));
        }
        return { proof, credential: credentialForScope(credential, scope) };
      }
      onProgress?.('Confirming eligibility registry on-chain…');
      let activeCredential = credential;
      if (walletField) {
        const syncResult = await ensureRegistryRootForWallet(
          config.issuerServiceUrl,
          walletField,
          policyKey,
        ).catch(() => null);
        if (syncResult?.root) {
          activeCredential = {
            ...activeCredential,
            credential: { ...activeCredential.credential, root: syncResult.root },
          };
          setCredentialState(activeCredential);
          if (address) {
            persistSession({ address, walletField, credential: activeCredential });
          }
        }
      }
      const rootsReady = await waitForCredentialRootsReady(config, activeCredential, proof, onProgress);
      if (!rootsReady) {
        throw new Error(registryRootMismatchMessage());
      }
      const scopedCredential = credentialForScope(activeCredential, scope);
      onProgress?.('Generating private proof in your browser…');
      const { bundle, durationSec } = await generateProof(scopedCredential, (p) => {
        onProgress?.(p.message);
      });
      setProof(bundle, durationSec, scopedCredential);
      clearLocalProofBindCache();
      setSessionProofBound(false);
      pushActivity({
        kind: 'proof',
        title: `${asset.toUpperCase()} eligibility prepared`,
        detail: `Asset scope ${scope.assetId} — proof stays on your device until you authorize`,
        status: 'success',
      });
      return { proof: bundle, credential: scopedCredential };
    },
    [credential, proof, setProof, pushActivity, config, walletField, policyKey, address, persistSession],
  );

  const isScopeSettlementAvailable = useCallback(
    async (asset: SettlementAsset): Promise<boolean> => {
      if (!credential) return false;
      const scope = ASSET_SCOPES[asset];
      try {
        return !(await isScopeNullifierSpent(config, credential, scope));
      } catch {
        return true;
      }
    },
    [credential, config],
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
      const holder = settlementAddress ?? address;
      const balance = BigInt(await readBalance(config, holder));
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
        title: 'Balance privately confirmed',
        detail: `Threshold ${threshold.toString()} met without revealing balance`,
        status: 'success',
      });
      return bundle;
    },
    [walletField, address, settlementAddress, config, credential, proof, proofDurationSec, policyKey, selectedOfferingId, persistSession, pushActivity],
  );

  const recordTransferTx = useCallback(
    async (hash: string, result: ProofReceiptTransferResult) => {
      recoveryLog('transfer.consumed', { hash, from: result.from, to: result.to });
      const txs = { ...receiptTransactions, transfer: hash };
      const ownerAddress = currentSettlementOwner(config, address, settlementAddress);
      const archivedProof =
        proof && credential && proofMatchesCredential(proof, credential) ? proof : null;
      const frozenReceipt =
        ownerAddress && walletField && credential && archivedProof
          ? await buildProofReceipt({
              config,
              address: ownerAddress,
              walletField,
              walletModuleId: walletModuleId ?? undefined,
              walletModuleName: walletModuleName ?? undefined,
              policyKey,
              credential,
              proof: archivedProof,
              transactions: txs,
              transferResult: result,
              replayBlocked,
              replayMessage: replayMessage ?? undefined,
            })
          : null;
      setReceiptTransactions(txs);
      setTransferResult(result);
      if (frozenReceipt) setProofReceipt(frozenReceipt);
      setConsumedTxHash(hash);
      setProofState(null);
      setPassportActivatedState(false);
      setProofLifecycle({
        lifecycle: 'none',
        consumedTxHash: hash,
        reason: 'Settlement completed. Generate a new asset-scoped proof for the next action.',
      });
      persistReceiptState({
        proof: null,
        passportActivated: false,
        receiptTransactions: txs,
        transferResult: result,
        proofReceipt: frozenReceipt,
        settlementProofArchive: archivedProof,
        consumedTxHash: hash,
        proofLifecycle: 'none',
      });
      return frozenReceipt;
    },
    [
      receiptTransactions,
      address,
      settlementAddress,
      walletField,
      credential,
      proof,
      config,
      walletModuleId,
      walletModuleName,
      policyKey,
      replayBlocked,
      replayMessage,
      persistReceiptState,
    ],
  );

  const beginProofRecovery = useCallback(() => {
    if (!walletField || (!address && !smartAccount)) {
      recoveryLog('recovery.blocked', { reason: 'wallet or smart account not ready' });
      return;
    }
    const previousTx = consumedTxHash ?? proofLifecycle.consumedTxHash ?? receiptTransactions.transfer ?? null;
    recoveryLog('recovery.begin', {
      address,
      settlementAddress,
      previousTx,
      hadCredential: Boolean(credential),
      lifecycle: proofLifecycle.lifecycle,
    });

    setCredentialState(null);
    setProofState(null);
    setPofProofState(null);
    setProofDurationSec(null);
    setPassportActivatedState(false);
    setReplayBlocked(false);
    setReplayMessage(null);
    clearLocalProofBindCache();
    setSessionProofBound(false);
    setProofLifecycle({
      lifecycle: 'none',
      consumedTxHash: null,
      reason: previousTx
        ? `Previous settlement ${previousTx.slice(0, 12)}… — request a new passport below.`
        : 'Request a new passport, then confirm eligibility again.',
    });

    const recoveryPartial = {
      credential: null,
      proof: null,
      pofProof: null,
      proofDurationSec: null,
      passportActivated: false,
      consumedTxHash: null,
      proofLifecycle: 'none' as const,
      replayBlocked: false,
      replayMessage: null,
    };

    if (address && walletField) {
      persistSession({ address, walletField, ...recoveryPartial });
    }
    if (smartAccount && walletField) {
      persistPasskeySession({
        smartAccountAddress: smartAccount.smartAccountAddress,
        walletField,
        smartAccount,
        ...recoveryPartial,
      });
    }

    pushActivity({
      kind: 'verify',
      title: 'Recovery started',
      detail: 'Request a new passport — each settlement needs fresh eligibility',
      status: 'info',
    });
  }, [
    address,
    walletField,
    smartAccount,
    settlementAddress,
    credential,
    consumedTxHash,
    proofLifecycle,
    receiptTransactions.transfer,
    persistSession,
    persistPasskeySession,
    pushActivity,
  ]);

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

  const verifyDuplicateBlock = useCallback(
    async (to: string, amount: string) => {
      if (!address || !proof) throw new Error('Connect wallet and generate proof first');
      try {
        await buildTransferTransaction(config, address, settlementAddress ?? address, to, amount, proof, ASSET_SCOPES.rwa);
        setReplayBlocked(false);
        setReplayMessage('Duplicate check passed unexpectedly — this passport may not be marked used yet.');
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
    [address, proof, settlementAddress, config, walletField, persistSession, pushActivity],
  );

  const buildDisclosure = useCallback(
    (txHash?: string): DisclosurePack | null => {
      const ownerAddress = currentSettlementOwner(config, address, settlementAddress);
      if (!ownerAddress || !walletField || !credential) return null;
      if (proofReceipt) {
        return buildDisclosurePackFromReceipt({
          credential,
          receipt: proofReceipt,
          txHash: txHash ?? receiptTransactions.transfer,
        });
      }
      const archivedProof = loadPasskeySession()?.settlementProofArchive ?? null;
      const effectiveProof =
        proof && proofMatchesCredential(proof, credential)
          ? proof
          : archivedProof && proofMatchesCredential(archivedProof, credential)
            ? archivedProof
            : null;
      if (!effectiveProof) return null;
      return buildDisclosurePack({
        walletAddress: ownerAddress,
        walletField,
        policyKey,
        credential,
        proof: effectiveProof,
        txHash: txHash ?? receiptTransactions.transfer,
      });
    },
    [address, settlementAddress, walletField, credential, proof, proofReceipt, policyKey, receiptTransactions.transfer, config],
  );

  const setPassportActivated = useCallback(
    (active: boolean) => {
      setPassportActivatedState(active);
      if (address && walletField) {
        persistSession({ address, walletField, passportActivated: active });
      }
    },
    [address, walletField, persistSession],
  );

  const signAndSubmit = useCallback(
    async (tx: SignableTransaction) => {
      if (isAssembledTransaction(tx)) {
        if (!smartAccount) {
          throw new Error('Create and fund your smart account before settlement.');
        }
        return submitSmartAccountOperation(config, smartAccount, tx);
      }
      const { signedTxXdr } = await kit.signTransaction(tx, {
        networkPassphrase: config.networkPassphrase,
        address: address || undefined,
      });
      return submitSignedTransaction(config, signedTxXdr);
    },
    [kit, config, address, smartAccount],
  );

  const signAndSubmitSettlement = useCallback(
    async (
      settlementFrom: string,
      proof: ProofBundle,
      tx: SmartAccountAssembledTransaction,
      onPasskeyStep?: (step: 'bind' | 'settle', index: number, total: number) => void,
    ): Promise<string> => {
      if (!smartAccount) {
        throw new Error('Create and fund your smart account before settlement.');
      }
      await assertSmartAccountReadyForSettlement(config, smartAccount);
      const sessionStatus = await getLumengateSessionStatus(config, smartAccount);
      if (!sessionStatus.enabled) {
        throw new Error('Enable Trusted device (7 days) before settlement.');
      }
      const bindSource = resolvePasskeySimulationSource(address);
      let boundOnChain = false;
      if (config.sessionStoreId && isContractAddress(settlementFrom)) {
        const bound = await readSessionProofBound(config, settlementFrom);
        boundOnChain = Boolean(bound && sessionProofMatchesBound(bound, proof));
      }

      if (config.sessionStoreId && isContractAddress(settlementFrom) && !boundOnChain) {
        try {
          onPasskeyStep?.('bind', 1, 1);
          const bindTx = await buildBindSessionProofTransaction(
            config,
            bindSource,
            settlementFrom,
            proof,
          );
          const bindHash = await submitWithLumengateSession(config, smartAccount, bindTx, { forceMethod: 'rpc' });
          setSessionProofBound(true);
          markProofBoundLocally(proof);
          setReceiptTransactions((prev) => {
            const txs = { ...prev, sessionBind: bindHash };
            if (address && walletField) {
              persistSession({ address, walletField, receiptTransactions: txs });
            } else if (smartAccount && walletField) {
              persistPasskeySession({
                smartAccountAddress: smartAccount.smartAccountAddress,
                walletField,
                smartAccount,
                receiptTransactions: txs,
              });
            }
            return txs;
          });
        } catch (err) {
          const raw = err instanceof Error ? err.message : String(err);
          throw new Error(`Session proof bind failed: ${formatSorobanUserError(raw)}`);
        }
      } else if (boundOnChain || isProofBoundLocally(proof)) {
        setSessionProofBound(true);
        markProofBoundLocally(proof);
      }
      try {
        onPasskeyStep?.('settle', 1, 1);
        const hash = await submitWithLumengateSession(config, smartAccount, tx);
        await refreshConfidentialEurcBalance();
        return hash;
      } catch (err) {
        const raw = err instanceof Error ? err.message : String(err);
        throw new Error(`Settlement failed: ${formatSorobanUserError(raw)}`);
      }
    },
    [config, address, smartAccount, walletField, persistSession, persistPasskeySession, refreshConfidentialEurcBalance],
  );

  const fundSmartAccountUsdc = useCallback(
    async (amount: string): Promise<string> => {
      if (!address) throw new Error('Connect wallet first');
      if (!settlementAddress) throw new Error('Create your smart account first');
      const xdr = await buildFundSmartAccountUsdcXdr(config, address, settlementAddress, amount);
      const hash = await signAndSubmit(xdr);
      pushActivity({
        kind: 'verify',
        title: 'Smart account funded',
        detail: `${amount} USDC → ${settlementAddress.slice(0, 8)}…`,
        txHash: hash,
        status: 'success',
      });
      return hash;
    },
    [address, settlementAddress, config, signAndSubmit, pushActivity],
  );

  const fundSmartAccountEurc = useCallback(
    async (amount: string): Promise<string> => {
      if (!address) throw new Error('Connect wallet first');
      if (!settlementAddress) throw new Error('Create your smart account first');
      const xdr = await buildFundSmartAccountEurcXdr(config, address, settlementAddress, amount);
      const hash = await signAndSubmit(xdr);
      pushActivity({
        kind: 'verify',
        title: 'Smart account funded with EURC',
        detail: `${amount} EURC → ${settlementAddress.slice(0, 8)}…`,
        txHash: hash,
        status: 'success',
      });
      return hash;
    },
    [address, settlementAddress, config, signAndSubmit, pushActivity],
  );

  const fundSmartAccountXlm = useCallback(
    async (amountXlm: string): Promise<string> => {
      if (!address) throw new Error('Connect wallet first');
      if (!settlementAddress) throw new Error('Create your smart account first');
      const xdr = await buildFundSmartAccountXlmXdr(config, address, settlementAddress, amountXlm);
      const hash = await signAndSubmit(xdr);
      pushActivity({
        kind: 'verify',
        title: 'Smart account funded with XLM',
        detail: `${amountXlm} XLM → ${settlementAddress.slice(0, 8)}…`,
        txHash: hash,
        status: 'success',
      });
      return hash;
    },
    [address, settlementAddress, config, signAndSubmit, pushActivity],
  );

  const value: AppContextValue = {
    config,
    address,
    walletField,
    walletModuleId,
    walletModuleName,
    smartAccount,
    settlementAddress,
    smartAccountCreating,
    smartAccountStale,
    createSmartAccount,
    replaceSmartAccount,
    connecting,
    connect,
    signInWithPasskey,
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
    passportActivated,
    setPassportActivated,
    proofLifecycle,
    syncProofLifecycle,
    consumedTxHash,
    beginProofRecovery,
    setCredential,
    setProof,
    setPofProof,
    ensureProofForAsset,
    isScopeSettlementAvailable,
    bindSessionProofIfNeeded,
    confirmPassportEligibility,
    sessionProofBound,
    lumengateSessionStatus,
    enableLumengateSession,
    revokeLumengateSession,
    refreshLumengateSessionStatus,
    confidentialEurcBalance,
    confidentialBalanceLoading,
    refreshConfidentialEurcBalance,
    passkeyBusy,
    refreshSessionProofBound,
    proverReady,
    proverWarmupMessage,
    proverWarmupError,
    fundSmartAccountUsdc,
    fundSmartAccountEurc,
    fundSmartAccountXlm,
    generatePofProofForWallet,
    setPolicyKey,
    setSelectedOfferingId,
    requestCredential,
    buildDisclosure,
    refreshProofReceipt,
    recordTransferTx,
    recordVerifyTx,
    verifyDuplicateBlock,
    activity,
    pushActivity,
    signAndSubmit,
    signAndSubmitSettlement,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
