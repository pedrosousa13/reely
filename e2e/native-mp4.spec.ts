import { expect, test } from '@playwright/test';

test('plays an MP4 and reports only confirmed media states', async ({
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
});
