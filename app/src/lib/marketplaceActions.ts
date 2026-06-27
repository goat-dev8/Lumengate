import type { PassportScopeRow } from './passportScopeStatus';
import { offeringSettlementAsset } from './passportScopeStatus';
import type { LiveOffering } from './offerings';
import { microcopy } from './microcopy';

export type MarketplaceAction = {
  message: string;
  cta: string;
  href: string;
  primary: boolean;
};

export function resolveMarketplaceAction(input: {
  offering: LiveOffering;
  block: string | null;
  scopeRows: PassportScopeRow[] | null;
  hasSettlementAddress: boolean;
  hasCredential: boolean;
  hasActiveProof: boolean;
}): MarketplaceAction | null {
  const { offering, block, scopeRows, hasSettlementAddress, hasCredential, hasActiveProof } = input;

  if (!hasSettlementAddress) {
    return {
      message: 'Create your secure Lumengate account before investing.',
      cta: microcopy.welcome.createAccount,
      href: '/app/welcome?intent=new',
      primary: true,
    };
  }

  if (!hasCredential) {
    return {
      message: 'Request your Private Financial Passport to unlock regulated investments.',
      cta: microcopy.marketplace.getPassport,
      href: '/app/verify',
      primary: true,
    };
  }

  const asset = offeringSettlementAsset(offering.settlementAsset);
  const scope = scopeRows?.find((r) => r.asset === asset);
  if (scope?.status === 'renewal_required' || scope?.status === 'used') {
    return {
      message: `${scope.label} eligibility was used. Renew this scope on Passport — your other assets may still be ready.`,
      cta: microcopy.passport.requestNew,
      href: '/app/verify#recovery-credential',
      primary: true,
    };
  }

  if (!hasActiveProof) {
    return {
      message: 'Confirm eligibility privately on Passport before investing in this offering.',
      cta: 'Complete eligibility',
      href: '/app/verify',
      primary: true,
    };
  }

  if (block) {
    const lower = block.toLowerCase();
    if (lower.includes('passport') || lower.includes('renew')) {
      return {
        message: block,
        cta: microcopy.passport.requestNew,
        href: '/app/verify#recovery-credential',
        primary: true,
      };
    }
    if (lower.includes('balance') || lower.includes('minimum') || lower.includes('usdc') || lower.includes('eurc')) {
      return {
        message: block,
        cta: 'Add funds on Send',
        href: '/app/send',
        primary: true,
      };
    }
    if (lower.includes('credential') || lower.includes('policy')) {
      return {
        message: block,
        cta: microcopy.marketplace.getPassport,
        href: '/app/verify',
        primary: true,
      };
    }
    if (lower.includes('proof') || lower.includes('eligibility') || lower.includes('confirm')) {
      return {
        message: block,
        cta: 'Complete eligibility',
        href: '/app/verify',
        primary: true,
      };
    }
    return {
      message: block,
      cta: 'View passport',
      href: '/app/verify',
      primary: true,
    };
  }

  return null;
}
