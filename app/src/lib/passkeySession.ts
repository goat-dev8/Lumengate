import type { IssuerCredentialResponse } from './config';
import type { ProofBundle } from './contracts';
import type { PolicyKey } from './policies';
import type { SmartAccountState } from './smartAccount';
import type { ProofReceipt, ProofReceiptTransactions, ProofReceiptTransferResult } from './proofReceipt';
import {
  type WalletSession,
  saveWalletSession,
  loadWalletSession,
} from './session';

const PASSKEY_SESSION_KEY = 'lumengate.passkey.session.v1';

/** Passkey-first session keyed by smart account — no funding wallet required. */
export type PasskeySession = {
  smartAccountAddress: string;
  walletField: string;
  smartAccount: SmartAccountState;
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
  passportActivated?: boolean;
  proofLifecycle?: 'none' | 'ready' | 'consumed' | 'invalid';
  consumedTxHash?: string | null;
  fundingWalletAddress?: string | null;
  updatedAt: number;
};

export function loadPasskeySession(): PasskeySession | null {
  try {
    const raw = localStorage.getItem(PASSKEY_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PasskeySession;
    if (!parsed.smartAccountAddress || !parsed.walletField || !parsed.smartAccount) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function savePasskeySession(session: PasskeySession): void {
  localStorage.setItem(
    PASSKEY_SESSION_KEY,
    JSON.stringify({ ...session, updatedAt: Date.now() }),
  );
}

export function clearPasskeySession(): void {
  localStorage.removeItem(PASSKEY_SESSION_KEY);
}

/** Merge passkey session into wallet session when user connects Freighter for funding. */
export function linkPasskeySessionToWallet(fundingAddress: string, _fundingWalletField: string): WalletSession | null {
  const passkey = loadPasskeySession();
  if (!passkey) return null;
  const existing = loadWalletSession(fundingAddress);
  const merged: WalletSession = {
    address: fundingAddress,
    walletField: passkey.walletField,
    smartAccount: passkey.smartAccount,
    credential: passkey.credential ?? existing?.credential ?? null,
    proof: passkey.proof ?? existing?.proof ?? null,
    pofProof: passkey.pofProof ?? existing?.pofProof ?? null,
    proofDurationSec: passkey.proofDurationSec ?? existing?.proofDurationSec ?? null,
    policyKey: passkey.policyKey ?? existing?.policyKey ?? 'general-eligibility',
    selectedOfferingId: passkey.selectedOfferingId ?? existing?.selectedOfferingId ?? null,
    receiptTransactions: passkey.receiptTransactions ?? existing?.receiptTransactions ?? {},
    transferResult: passkey.transferResult ?? existing?.transferResult ?? null,
    replayBlocked: passkey.replayBlocked ?? existing?.replayBlocked ?? false,
    replayMessage: passkey.replayMessage ?? existing?.replayMessage ?? null,
    proofReceipt: passkey.proofReceipt ?? existing?.proofReceipt ?? null,
    passportActivated: passkey.passportActivated ?? existing?.passportActivated ?? false,
    proofLifecycle: passkey.proofLifecycle ?? existing?.proofLifecycle,
    consumedTxHash: passkey.consumedTxHash ?? existing?.consumedTxHash ?? null,
    updatedAt: Date.now(),
  };
  saveWalletSession(merged);
  savePasskeySession({ ...passkey, fundingWalletAddress: fundingAddress });
  return merged;
}

export function passkeySessionToWalletSession(
  passkey: PasskeySession,
  fundingAddress?: string | null,
): WalletSession {
  return {
    address: fundingAddress ?? passkey.smartAccountAddress,
    walletField: passkey.walletField,
    smartAccount: passkey.smartAccount,
    credential: passkey.credential,
    proof: passkey.proof,
    pofProof: passkey.pofProof,
    proofDurationSec: passkey.proofDurationSec,
    policyKey: passkey.policyKey,
    selectedOfferingId: passkey.selectedOfferingId,
    receiptTransactions: passkey.receiptTransactions,
    transferResult: passkey.transferResult,
    replayBlocked: passkey.replayBlocked,
    replayMessage: passkey.replayMessage,
    proofReceipt: passkey.proofReceipt,
    passportActivated: passkey.passportActivated,
    proofLifecycle: passkey.proofLifecycle,
    consumedTxHash: passkey.consumedTxHash,
    updatedAt: passkey.updatedAt,
  };
}
