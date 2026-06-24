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

/** Consumer onboarding progress on the receipt page. */
export function buildUserJourney(input: JourneyInput): JourneyStep[] {
  const hasWallet = Boolean(input.address);
  const hasCredential = Boolean(input.credential);
  const hasProof = Boolean(input.proof && input.proofMatches);
  const hasTransfer =
    Boolean(input.receipt?.transactions.transfer) ||
    input.receipt?.settlementStatus === 'verified';
  const hasReceipt = input.receipt?.settlementStatus === 'verified' || Boolean(input.receipt?.transactions.transfer);
  const hasReplay = input.replayBlocked || Boolean(input.receipt?.replayBlocked);

  const steps: Omit<JourneyStep, 'state'>[] = [
    {
      id: 'connect',
      label: 'Connect wallet',
      description: 'Link your Stellar account to begin.',
      href: '/app/verify',
    },
    {
      id: 'credential',
      label: 'Get passport',
      description: 'Receive your private eligibility passport.',
      href: '/app/verify',
    },
    {
      id: 'prove',
      label: 'Confirm eligibility',
      description: 'Private confirmation that you are allowed to invest.',
      href: '/app/verify',
    },
    {
      id: 'invest',
      label: 'Invest or send',
      description: 'Complete a compliant settlement on Stellar.',
      href: '/app/marketplace',
    },
    {
      id: 'receipt',
      label: 'Settlement receipt',
      description: 'Your audit-ready record is saved here.',
      href: '/app/compliance',
    },
    {
      id: 'replay',
      label: 'One-time use',
      description: 'Each passport authorizes one settlement — renew for the next one.',
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

