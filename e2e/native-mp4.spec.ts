import { expect, test } from '@playwright/test';

test('plays, pauses, and ends an MP4 with confirmed native states', async ({
  page
}) => {
  await page.goto(
    '/iframe.html?id=fixtures-playerfixture--native-mp-4&viewMode=story'
  );

  await page.getByRole('button', { name: 'Play' }).click();

  const pauseButton = page.getByRole('button', { name: 'Pause' });
  await expect(pauseButton).toHaveAttribute('data-state', 'playing');

  await pauseButton.click();
  await expect(page.getByRole('button', { name: 'Play' })).toHaveAttribute(
    'data-state',
    'paused'
  );

  await page.getByRole('button', { name: 'Play' }).click();
  await expect(page.getByRole('button', { name: 'Play' })).toHaveAttribute(
    'data-state',
    'ended'
  );
});
