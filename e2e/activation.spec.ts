import { expect, test } from '@playwright/test';

test('interaction activation makes no provider request before click', async ({
  page
}) => {
  const providerRequests: string[] = [];
  await page.route('https://provider.invalid/**', async (route) => {
    providerRequests.push(route.request().url());
    await route.fulfill({
      body: '',
      contentType: 'video/mp4',
      status: 200
    });
  });

  await page.goto('/?loading=interaction&activationSource=external');
  const activationButton = page.getByRole('button', { name: 'Play video' });
  await expect(activationButton).toBeVisible();
  await expect(page.getByTestId('viewport')).toBeVisible();
  await activationButton.evaluate((button) => {
    button.addEventListener(
      'click',
      () => {
        button.dataset.clickTime = String(performance.now());
      },
      { capture: true, once: true }
    );
  });
  expect(providerRequests).toEqual([]);

  await activationButton.click();

  await expect.poll(() => providerRequests.length).toBeGreaterThan(0);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          performance.getEntriesByName(
            'https://provider.invalid/tracer.mp4',
            'resource'
          ).length
      )
    )
    .toBeGreaterThan(0);
  const { clickTime, startTimes } = await activationButton.evaluate(
    (button) => ({
      clickTime: Number(button.dataset.clickTime),
      startTimes: performance
        .getEntriesByName('https://provider.invalid/tracer.mp4', 'resource')
        .map(({ startTime }) => startTime)
    })
  );
  expect(
    providerRequests.every(
      (url) => url === 'https://provider.invalid/tracer.mp4'
    )
  ).toBe(true);
  expect(startTimes.every((startTime) => startTime >= clickTime)).toBe(true);
});
