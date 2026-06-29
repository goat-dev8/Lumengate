import { test, expect } from '@playwright/test';

test.describe('Confidential Token (Stellar Developer Preview)', () => {
  test('send page shows confidential EURC option when configured', async ({ page }) => {
    await page.goto('/app/send');
    await expect(page.locator('body')).not.toBeEmpty();
    const eurc = page.getByRole('button', { name: 'EURC' });
    if (await eurc.isVisible()) {
      await eurc.click();
    }
    const ctToggle = page.getByText(/Confidential EURC settlement/i);
    await expect(ctToggle).toBeVisible({ timeout: 15_000 });
  });

  test('issuer CT deployments endpoint returns token config', async ({ request }) => {
    const issuerUrl = process.env.ISSUER_SERVICE_URL || 'https://lumengate-issuer.onrender.com';
    const res = await request.get(`${issuerUrl}/ct/deployments`);
    test.skip(res.status() !== 200, 'CT deployments not available');
    const body = await res.json();
    expect(body.deployment?.token).toMatch(/^C[A-Z0-9]{55}$/);
    expect(body.deployment?.verifier).toMatch(/^C[A-Z0-9]{55}$/);
    expect(body.deployment?.policy).toMatch(/^C[A-Z0-9]{55}$/);
  });
});
