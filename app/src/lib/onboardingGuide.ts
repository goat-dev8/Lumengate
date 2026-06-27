import type { IssuerCredentialResponse } from './config';
import type { ProofBundle } from './contracts';
import type { ProofLifecycleState } from './proofLifecycle';
import type { SmartAccountState } from './smartAccount';

export type OnboardingNextStep =
  | { kind: 'none' }
  | {
      kind: 'claim-faucet' | 'request-passport' | 'confirm-eligibility' | 'browse-investments';
      title: string;
      description: string;
      cta: string;
      href: string;
      secondaryCta?: string;
      secondaryHref?: string;
    };

export function resolveOnboardingNextStep(input: {
  smartAccount: SmartAccountState | null;
  settlementAddress: string | null;
  credential: IssuerCredentialResponse | null;
  proof: ProofBundle | null;
  lifecycle: ProofLifecycleState['lifecycle'];
  sessionProofBound: boolean | null;
  passkeyFirst?: boolean;
}): OnboardingNextStep {
  const hasAccount = Boolean(input.smartAccount && input.settlementAddress);
  if (!hasAccount) {
    return {
      kind: 'none',
    };
  }

  if (!input.credential) {
    return {
      kind: 'claim-faucet',
      title: 'Claim test funds first',
      description:
        'Grab free testnet USDC from the faucet below, then request your Private Financial Passport.',
      cta: 'Claim demo USDC',
      href: '#onboarding-faucet',
      secondaryCta: 'Skip to passport',
      secondaryHref: '#recovery-credential',
    };
  }

  const activeProof = input.lifecycle === 'ready' ? input.proof : null;
  if (!activeProof) {
    return {
      kind: 'confirm-eligibility',
      title: 'Confirm eligibility privately',
      description: 'Your passport was issued. Generate the local proof next — it stays in your browser.',
      cta: 'Continue to Step 3',
      href: '#recovery-proof',
    };
  }

  if (input.sessionProofBound === false) {
    return {
      kind: 'confirm-eligibility',
      title: 'Authorize with your passkey',
      description: 'One passkey confirmation binds your proof on-chain so you can send or invest.',
      cta: 'Authorize passkey',
      href: '#recovery-proof',
    };
  }

  return {
    kind: 'browse-investments',
    title: 'You are ready',
    description: 'Browse regulated investments or send USDC privately with your passport.',
    cta: 'Browse investments',
    href: '/app/marketplace',
    secondaryCta: 'Send privately',
    secondaryHref: '/app/send',
  };
}
