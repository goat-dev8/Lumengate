import type { IssuerCredentialResponse } from './config';
import type { ProofBundle } from './contracts';
import type { PolicyKey } from './policies';
import type { SmartAccountState } from './smartAccount';
import type { ProofReceipt, ProofReceiptTransactions, ProofReceiptTransferResult } from './proofReceipt';

const STORAGE_KEY = 'lumengate.session.v2';

export type WalletSession = {
  address: string;
  walletField: string;
  walletModuleId?: string;
  walletModuleName?: string;
  smartAccount?: SmartAccountState | null;
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
  proofReceipt?: ProofReceipt | null;
  settlementProofArchive?: ProofBundle | null;
  passportActivated?: boolean;
  proofLifecycle?: 'none' | 'ready' | 'consumed' | 'invalid';
  consumedTxHash?: string | null;
  updatedAt: number;
};

type SessionStore = Record<string, WalletSession>;

function readStore(): SessionStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as SessionStore;
  } catch {
    return {};
  }
}

function writeStore(store: SessionStore): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function loadWalletSession(address: string): WalletSession | null {
  const session = readStore()[address];
  return session ?? null;
}

export function saveWalletSession(session: WalletSession): void {
  const store = readStore();
  store[session.address] = { ...session, updatedAt: Date.now() };
  writeStore(store);
}

export function clearWalletSession(address: string): void {
  const store = readStore();
  delete store[address];
  writeStore(store);
}

const LAST_WALLET_KEY = 'lumengate.wallet.last';

export type LastWalletConnection = {
  address: string;
  walletField: string;
  walletModuleId?: string;
  walletModuleName?: string;
};

export function saveLastWalletConnection(conn: LastWalletConnection): void {
  localStorage.setItem(LAST_WALLET_KEY, JSON.stringify({ ...conn, savedAt: Date.now() }));
}

export function loadLastWalletConnection(): LastWalletConnection | null {
  try {
    const raw = localStorage.getItem(LAST_WALLET_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LastWalletConnection;
    if (!parsed.address || !parsed.walletField) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearLastWalletConnection(): void {
  localStorage.removeItem(LAST_WALLET_KEY);
}

/** Migrate v1 session if present */
export function migrateLegacySession(address: string): WalletSession | null {
  try {
    const legacyRaw = localStorage.getItem('lumengate.session.v1');
    if (!legacyRaw) return null;
    const legacy = JSON.parse(legacyRaw) as Record<string, WalletSession>;
    const entry = legacy[address];
    if (!entry) return null;
    const migrated: WalletSession = {
      ...entry,
      walletModuleId: entry.walletModuleId,
      walletModuleName: entry.walletModuleName,
      receiptTransactions: entry.receiptTransactions ?? {},
      transferResult: entry.transferResult ?? null,
      replayBlocked: entry.replayBlocked ?? false,
      replayMessage: entry.replayMessage ?? null,
    };
    saveWalletSession(migrated);
    return migrated;
  } catch {
    return null;
  }
}
