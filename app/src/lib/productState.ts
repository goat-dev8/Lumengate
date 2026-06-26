import type { IssuerCredentialResponse } from './config';
import type { ProofBundle } from './contracts';
import type { ProofLifecycleState } from './proofLifecycle';

export type ProductStepId = 'connect' | 'verify' | 'passport' | 'invest' | 'receipt';

export type ProductStep = {
  id: ProductStepId;
  label: string;
  description: string;
  state: 'complete' | 'current' | 'upcoming';
};

export type ProductReadiness = {
  title: string;
  description: string;
  cta: string;
  href: string;
  tone: 'default' | 'ready' | 'warning';
};

export function buildProductSteps(input: {
  address: string | null;
  settlementAddress?: string | null;
  credential: IssuerCredentialResponse | null;
  proof: ProofBundle | null;
  lifecycle: ProofLifecycleState['lifecycle'];
  hasSettlement?: boolean;
  passkeyFirst?: boolean;
}): ProductStep[] {
  const hasAccount = Boolean(input.settlementAddress ?? input.address);
  const flags = [
    input.passkeyFirst ? hasAccount : Boolean(input.address),
    Boolean(input.credential && input.lifecycle !== 'consumed'),
    Boolean(input.proof && input.lifecycle === 'ready'),
    Boolean(input.proof && input.lifecycle === 'ready'),
    Boolean(input.hasSettlement),
  ];
  const firstIncomplete = flags.findIndex((flag) => !flag);
  const currentIndex = firstIncomplete === -1 ? flags.length - 1 : firstIncomplete;
  const steps: Omit<ProductStep, 'state'>[] = input.passkeyFirst
    ? [
        { id: 'connect', label: 'Passkey', description: 'Create your smart account.' },
        { id: 'verify', label: 'Verify', description: 'Confirm you meet the policy.' },
        { id: 'passport', label: 'Passport', description: 'Receive your private passport.' },
        { id: 'invest', label: 'Invest', description: 'Choose a regulated offering.' },
        { id: 'receipt', label: 'Receipt', description: 'Keep your settlement record.' },
      ]
    : [
        { id: 'connect', label: 'Connect', description: 'Link your Stellar wallet.' },
        { id: 'verify', label: 'Verify', description: 'Confirm you meet the policy.' },
        { id: 'passport', label: 'Passport', description: 'Receive your private passport.' },
        { id: 'invest', label: 'Invest', description: 'Choose a regulated offering.' },
        { id: 'receipt', label: 'Receipt', description: 'Keep your settlement record.' },
      ];

  return steps.map((step, index) => ({
    ...step,
    state: flags[index] ? 'complete' : index === currentIndex ? 'current' : 'upcoming',
  }));
}

export function getProductReadiness(input: {
  address: string | null;
  settlementAddress?: string | null;
  credential: IssuerCredentialResponse | null;
  proof: ProofBundle | null;
  lifecycle: ProofLifecycleState['lifecycle'];
  passkeyFirst?: boolean;
}): ProductReadiness {
  const hasFundingWallet = Boolean(input.address);
  const hasSmartAccount = Boolean(input.settlementAddress);

  if (input.passkeyFirst && !hasSmartAccount && !hasFundingWallet) {
    return {
      title: 'Start with your passkey',
      description: 'Create a smart account with WebAuthn — connect a wallet only when you need to add funds.',
      cta: 'Create passkey account',
      href: '/app/verify',
      tone: 'default',
    };
  }

  if (!input.passkeyFirst && !hasFundingWallet) {
    return {
      title: 'Private investing on Stellar',
      description: 'Connect once, verify eligibility privately, then access regulated investments.',
      cta: 'Connect wallet',
      href: '/app/verify',
      tone: 'default',
    };
  }
  if (input.lifecycle === 'consumed') {
    return {
      title: 'Renew your passport for the next move',
      description: 'Your last settlement succeeded. Issue a fresh passport before you invest or send again.',
      cta: 'Renew passport',
      href: '/app/verify#recovery-credential',
      tone: 'warning',
    };
  }
  if (!input.credential) {
    return {
      title: 'Verify your eligibility',
      description: 'Get a private passport that proves you are allowed without revealing who you are.',
      cta: 'Start verification',
      href: '/app/verify',
      tone: 'default',
    };
  }
  if (!input.proof || input.lifecycle !== 'ready') {
    return {
      title: 'Finish your private passport',
      description: 'Confirm eligibility in your browser — takes a few seconds and stays on your device.',
      cta: 'Confirm eligibility',
      href: '/app/verify',
      tone: 'default',
    };
  }
  return {
    title: 'You are ready to invest',
    description: 'Your passport is active for one compliant settlement. Choose an offering or send privately.',
    cta: 'Browse investments',
    href: '/app/marketplace',
    tone: 'ready',
  };
}

export function friendlyAssetName(asset: 'rwa' | 'usdc' | 'eurc'): string {
  if (asset === 'usdc') return 'USDC';
  if (asset === 'eurc') return 'EURC';
  return 'Treasury units';
}
