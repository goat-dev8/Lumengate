import type { ProofReceipt } from './proofReceipt';
import type { IssuerCredentialResponse } from './config';
import type { ProofBundle } from './contracts';

export type JourneyStepId =
  | 'connect'
  | 'credential'
  | 'prove'
  | 'invest'
  | 'receipt'
  | 'replay';

export type JourneyStep = {
  id: JourneyStepId;
  label: string;
  description: string;
  href: string;
  state: 'complete' | 'current' | 'upcoming';
};

export type JourneyInput = {
  address: string | null;
  credential: IssuerCredentialResponse | null;
  proof: ProofBundle | null;
  proofMatches: boolean;
  receipt: ProofReceipt | null;
  replayBlocked: boolean;
};

/** Institutional onboarding progress — no demo framing. */
export function buildUserJourney(input: JourneyInput): JourneyStep[] {
  const hasWallet = Boolean(input.address);
  const hasCredential = Boolean(input.credential);
  const hasProof = Boolean(input.proof && input.proofMatches);
  const hasTransfer =
    Boolean(input.receipt?.transactions.transfer) ||
    input.receipt?.settlementStatus === 'verified';
  const hasReceipt = input.receipt?.settlementStatus === 'verified';
  const hasReplay = input.replayBlocked || Boolean(input.receipt?.replayBlocked);

  const steps: Omit<JourneyStep, 'state'>[] = [
    {
      id: 'connect',
      label: 'Connect account',
      description: 'Link your Stellar account to begin eligibility verification.',
      href: '/app/passport',
    },
    {
      id: 'credential',
      label: 'Receive credential',
      description: 'Issuer attestation bound to your account — identity stays off-chain.',
      href: '/app/verify',
    },
    {
      id: 'prove',
      label: 'Confirm eligibility',
      description: 'Private confirmation that you satisfy the active policy.',
      href: '/app/verify',
    },
    {
      id: 'invest',
      label: 'Settle privately',
      description: 'Move USDC, EURC, or tokenized assets with compliance enforced at settlement.',
      href: '/app/send',
    },
    {
      id: 'receipt',
      label: 'Compliance receipt',
      description: 'Verifiable settlement record for your auditor.',
      href: '/app/compliance',
    },
    {
      id: 'replay',
      label: 'Replay protection',
      description: 'Each confirmation can authorize settlement once — reuse is blocked on-chain.',
      href: '/app/compliance',
    },
  ];

  const flags = [hasWallet, hasCredential, hasProof, hasTransfer, hasReceipt, hasReplay];
  let currentIndex = flags.findIndex((f) => !f);
  if (currentIndex === -1) currentIndex = steps.length - 1;

  return steps.map((step, i) => ({
    ...step,
    state: flags[i] ? 'complete' : i === currentIndex ? 'current' : 'upcoming',
  }));
}

/** @deprecated use buildUserJourney */
export const buildDemoJourney = buildUserJourney;
