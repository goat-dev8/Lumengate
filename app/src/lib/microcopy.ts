/** User-facing copy — default UI must use these strings, not technical jargon. */

export const microcopy = {
  welcome: {
    title: 'Welcome to Lumengate',
    subtitle: 'Private investing and settlement — no seed phrase required.',
    createAccount: 'Create secure account',
    signIn: 'Sign in',
    signInHint: 'Use the passkey you created on this device.',
    noAccount: 'No saved account on this device. Create one to get started.',
  },
  account: {
    creating: 'Setting up your private account…',
    ready: 'Your Lumengate account is ready',
    create: 'Create secure account',
    passkeyPrompt: 'Use Face ID, fingerprint, or device PIN',
  },
  passport: {
    title: 'Your Private Financial Passport',
    subtitle: 'Prove eligibility without revealing who you are',
    scopeTitle: 'Passport status by asset',
    scopeSubtitle: 'Each settlement asset has its own scope. Using one does not expire the others.',
    scopeEmpty: 'Request your passport to see USDC, EURC, and Treasury scope status.',
    request: 'Request passport',
    requestNew: 'Renew passport',
    verify: 'Verify eligibility privately',
    authorize: 'Confirm with passkey',
    issued: 'Passport issued — access granted',
    renewTitle: 'Renew this asset scope',
    renewBody:
      'Only this asset scope was used on-chain. Request a fresh passport, confirm eligibility, and authorize with passkey for your next settlement.',
    scopeRenewHint: 'Other assets may still be ready — renew only what you need.',
    leaveWarning: 'Your passport request is still running. Leaving may interrupt on-chain registry sync.',
  },
  prove: {
    preparing: 'Preparing verification…',
    registry: 'Updating eligibility records…',
    witness: 'Building private witness…',
    proof: 'Generating proof on your device…',
    proofHint: 'Usually takes about 30 seconds. Nothing leaves this browser.',
    ready: 'You\'re eligible — ready to authorize',
  },
  send: {
    title: 'Send funds privately',
    subtitle: 'Settles in seconds on Stellar',
    primary: 'Send privately',
    addFunds: 'Add funds',
    authorizeBind: 'Confirm eligibility for this send',
    authorizeSettle: 'Approve this transfer',
    complete: 'Settlement confirmed',
    processingSecurely:
      'Everything is still processing securely. This may take up to a minute on the first run. Please keep this page open.',
    leaveWarning: 'A private settlement is in progress. Leaving now may interrupt it.',
  },
  receipt: {
    title: 'Settlement record',
    subtitle: 'Auditor-grade proof of compliant transfer',
    download: 'Download receipt',
    empty: 'Your settlement records will appear here after your first private transfer.',
  },
  marketplace: {
    title: 'Regulated investments',
    subtitle: 'Identity stays off-chain — only settlement reaches Stellar',
    invest: 'Invest now',
    getPassport: 'Get passport',
    privacyLine: 'Identity stays private',
    requirementPrefix: 'Before you can invest',
  },
  dashboard: {
    ready: 'You\'re verified and cleared for private investing and settlement.',
    renew: 'One asset scope was used. Renew only that scope on Passport — others may still be ready.',
    confirm: 'Confirm eligibility on your device to activate your private passport.',
    start: 'Create your secure account with a passkey — no seed phrase required.',
  },
  errors: {
    passkeyRejected: 'Confirmation cancelled. Try again when you\'re ready.',
    noPassport: 'Request your passport to get started — it takes about two minutes.',
    insufficientBalance: 'Add funds to continue — claim demo USDC on testnet.',
    invalidRecipient: 'Enter a valid Stellar address for this transfer.',
  },
  privacy: {
    splitTitle: 'What stays private vs what reaches Stellar',
    staysPrivate: 'Stays private',
    onLedger: 'On Stellar ledger',
  },
} as const;

export function passkeyStepLabel(index: number, total: number, kind: 'bind' | 'settle'): string {
  if (kind === 'bind') {
    return total > 1
      ? `Confirm with passkey (${index} of ${total}) — eligibility`
      : 'Confirm with passkey';
  }
  return total > 1
    ? `Approve transfer (${index} of ${total})`
    : 'Approve transfer';
}
