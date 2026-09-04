import { expect, test } from '@playwright/test';

test('the hero remains truthful after the governed revision is applied', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText(/This workspace currently implements Delete\./u)).toBeVisible();

  await page.getByRole('button', { name: 'Run opening rehearsal' }).click();
  await expect(page.getByRole('dialog', { name: 'Delete account' })).toBeVisible();
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Create Cancel proposal' }).click();
  const authority = page.getByRole('heading', { name: 'Complete exact authority' }).locator('..');
  await authority.getByRole('checkbox', {
    name: 'I reviewed this exact proposal and revision',
  }).check();
  await authority.getByRole('button', { name: 'Approve exact proposal' }).click();
  await page.getByRole('button', { name: 'Confirm approve' }).click();
  await authority.getByRole('button', { name: 'Apply approved proposal' }).click();
  await page.getByRole('button', { name: 'Confirm apply' }).click();

  await expect(page.getByRole('dialog', { name: 'Application committed' })).toContainText(
    'advanced revision 1 to 2',
  );
  await expect(page.getByText(/This workspace currently implements Cancel\./u)).toBeVisible();
  await expect(page.getByRole('region', { name: 'Current focus decision truth' })).toContainText(
    'IMPLEMENTED REVISION 2 · CANCEL',
  );
});
