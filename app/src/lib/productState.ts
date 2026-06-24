import type { IssuerCredentialResponse } from './config';
import type { ProofBundle } from './contracts';
import type { ProofLifecycleState } from './proofLifecycle';

export type ProductStepId = 'connect' | 'secure' | 'passport' | 'confirm' | 'invest' | 'receipt';

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
  passkeyReady?: boolean;
  credential: IssuerCredentialResponse | null;
  proof: ProofBundle | null;
  lifecycle: ProofLifecycleState['lifecycle'];
  hasSettlement?: boolean;
}): ProductStep[] {
  const flags = [
    Boolean(input.address),
    Boolean(input.passkeyReady),
    Boolean(input.credential && input.lifecycle !== 'consumed'),
    Boolean(input.proof && input.lifecycle === 'ready'),
    Boolean(input.hasSettlement),
    Boolean(input.hasSettlement),
  ];
  const current = Math.max(0, flags.findIndex((flag) => !flag));
  const currentIndex = current === -1 ? flags.length - 1 : current;
  const steps: Omit<ProductStep, 'state'>[] = [
    { id: 'connect', label: 'Connect', description: 'Link your Stellar account.' },
    { id: 'secure', label: 'Secure', description: 'Enable passkey on this device.' },
    { id: 'passport', label: 'Passport', description: 'Receive private eligibility.' },
    { id: 'confirm', label: 'Confirm', description: 'Confirm you are allowed.' },
    { id: 'invest', label: 'Invest', description: 'Choose an eligible asset.' },
    { id: 'receipt', label: 'Receipt', description: 'Keep an audit-ready record.' },
  ];

  return steps.map((step, index) => ({
    ...step,
    state: flags[index] ? 'complete' : index === currentIndex ? 'current' : 'upcoming',
  }));
}

export function getProductReadiness(input: {
  address: string | null;
  credential: IssuerCredentialResponse | null;
  proof: ProofBundle | null;
  lifecycle: ProofLifecycleState['lifecycle'];
}): ProductReadiness {
  if (!input.address) {
    return {
      title: 'Start with a private compliance passport',
      description: 'Connect once, confirm eligibility privately, then access regulated assets.',
      cta: 'Connect account',
      href: '/app/verify',
      tone: 'default',
    };
  }
  if (input.lifecycle === 'consumed') {
    return {
      title: 'Renew your passport for the next settlement',
      description: 'Your last confirmation was used successfully. Renew to invest or send again.',
      cta: 'Renew passport',
      href: '/app/verify#recovery-credential',
      tone: 'warning',
    };
  }
  if (!input.credential) {
    return {
      title: 'Get your compliance passport',
      description: 'The issuer confirms you meet the selected policy without publishing personal details.',
      cta: 'Get passport',
      href: '/app/verify',
      tone: 'default',
    };
  }
  if (!input.proof || input.lifecycle !== 'ready') {
    return {
      title: 'Confirm eligibility privately',
      description: 'Create a private confirmation in your browser before settlement.',
      cta: 'Confirm eligibility',
      href: '/app/verify',
      tone: 'default',
    };
  }
  return {
    title: 'Ready to invest',
    description: 'Your passport is active for one compliant settlement.',
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
