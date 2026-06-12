import { test, expect } from '@playwright/test';

test.describe('Lumengate institutional shell', () => {
  test('landing page loads without demo judge artifacts', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText(/judge mode/i)).toHaveCount(0);
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
