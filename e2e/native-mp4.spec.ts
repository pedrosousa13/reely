import { expect, test } from '@playwright/test';

test('plays, pauses, and ends an MP4 with confirmed native states', async ({
  page
}) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Play' }).click();

  const pauseButton = page.getByRole('button', { name: 'Pause' });
  await expect(pauseButton).toHaveAttribute('data-playback-state', 'playing');

  await pauseButton.click();
  await expect(page.getByRole('button', { name: 'Play' })).toHaveAttribute(
    'data-playback-state',
    'paused'
  );

  await page.getByLabel('Reely media').evaluate((media) => {
    media.dispatchEvent(new Event('ended'));
  });
  await expect(page.getByRole('button', { name: 'Play' })).toHaveAttribute(
    'data-playback-state',
    'ended'
  );
});
