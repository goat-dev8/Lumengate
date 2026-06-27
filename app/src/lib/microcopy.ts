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
    request: 'Request passport',
    requestNew: 'Renew passport',
    verify: 'Verify eligibility privately',
    authorize: 'Confirm with passkey',
    issued: 'Passport issued — access granted',
    renewTitle: 'Renew access',
    renewBody:
      'Your last settlement used this passport. Request a new one to invest or send again.',
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
  },
  dashboard: {
    ready: 'You\'re verified and cleared for private investing and settlement.',
    renew: 'Your last settlement succeeded. Renew your passport to invest or send again.',
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
