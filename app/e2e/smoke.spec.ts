import { test, expect } from '@playwright/test';

const routes = [
  { path: '/', name: 'Landing' },
  { path: '/app/dashboard', name: 'Dashboard' },
  { path: '/app/verify', name: 'Verify' },
  { path: '/app/passport', name: 'Passport' },
  { path: '/app/marketplace', name: 'Marketplace' },
  { path: '/app/send', name: 'Send' },
  { path: '/app/portfolio', name: 'Portfolio' },
  { path: '/app/compliance', name: 'Compliance' },
  { path: '/app/auditor', name: 'Auditor' },
  { path: '/app/admin', name: 'Admin' },
  { path: '/app/settings', name: 'Settings' },
  { path: '/app/activity', name: 'Activity' },
];

test.describe('Lumengate institutional shell', () => {
  test('landing page loads without demo judge artifacts', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText(/judge mode/i)).toHaveCount(0);
    await expect(page.getByText(/secp256k1/i)).toHaveCount(0);
  });

  for (const route of routes) {
    test(`${route.name} route renders`, async ({ page }) => {
      await page.goto(route.path);
      await expect(page.locator('body')).not.toBeEmpty();
      await expect(page.getByText(/judge mode/i)).toHaveCount(0);
    });
  }

  test('verify page shows passkey primary auth', async ({ page }) => {
    await page.goto('/app/verify');
    await expect(page.getByText(/Passkey account/i)).toBeVisible();
    await expect(page.getByText(/Primary auth/i)).toBeVisible();
  });

  test('issuer health reachable when service configured', async ({ request }) => {
    const issuerUrl = process.env.ISSUER_SERVICE_URL || 'http://127.0.0.1:3001';
    const res = await request.get(`${issuerUrl}/health`);
    test.skip(res.status() !== 200, 'issuer service not running');
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.signatureScheme).toBe('ed25519');
  });
});
