import { test, expect } from '@playwright/test';

test.describe('Proof recovery after consumption', () => {
  test('Start fresh passport clears stale credential and shows request button', async ({ page }) => {
    const wallet = 'GDFKWALLETTEST1234567890123456789012345678901234567890';
    const consumedTx = 'a7e345d5d950bc7a3425869ff616cbac0528d42c37918f05e1c05b6d799fa68a';

    await page.addInitScript(
      ({ wallet, consumedTx }) => {
        const staleCredential = {
          label: 'General RWA eligibility',
          issuerType: 'eligibility',
          policyKey: 'general-eligibility',
          issuedAt: Date.now() - 60_000,
          expiresAt: Date.now() + 86400000,
          credential: {
            root: '0xabc',
            revocationRoot: '0xdef',
            nullifier: '0xspentnullifier',
            policyId: 1,
          },
          proverInputs: { nullifier: '999888777', policy_id: '1' },
          walletField: '42',
        };
        localStorage.setItem(
          'lumengate.wallet.last',
          JSON.stringify({ address: wallet, walletField: '42' }),
        );
        localStorage.setItem(
          'lumengate.session.v2',
          JSON.stringify({
            [wallet]: {
              address: wallet,
              walletField: '42',
              credential: staleCredential,
              proof: null,
              pofProof: null,
              proofDurationSec: null,
              policyKey: 'general-eligibility',
              selectedOfferingId: null,
              receiptTransactions: { transfer: consumedTx },
              transferResult: null,
              replayBlocked: false,
              replayMessage: null,
              passportActivated: true,
              proofLifecycle: 'consumed',
              consumedTxHash: consumedTx,
              updatedAt: Date.now(),
            },
          }),
        );
      },
      { wallet, consumedTx },
    );

    await page.goto('/app/verify');
    await expect(page.getByText(/Proof consumed/i)).toBeVisible();
    await page.getByRole('button', { name: /Start fresh passport/i }).click();
    await expect(page.getByRole('button', { name: /Request new passport/i })).toBeVisible();
    await expect(page.getByText(/Passport credential ready/i)).toHaveCount(0);
  });
});
