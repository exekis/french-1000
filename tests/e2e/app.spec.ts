import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    class MockAudio extends EventTarget {
      static instances: MockAudio[] = [];
      src = '';
      preload = '';
      currentTime = 0;
      pauseCount = 0;

      constructor() {
        super();
        MockAudio.instances.push(this);
      }

      pause() {
        this.pauseCount += 1;
      }

      load() {}

      async play() {
        this.dispatchEvent(new Event('playing'));
      }
    }

    Object.defineProperty(window, 'Audio', { value: MockAudio });
    Object.defineProperty(window, '__audioInstances', {
      get: () => MockAudio.instances,
    });
  });
  await page.goto('./');
});

test('searches accents, meanings, examples, and Persian in rank order', async ({
  page,
  isMobile,
}) => {
  if (isMobile) {
    await expect(page.locator('[data-layout="cards"]')).toBeVisible();
  } else {
    await expect(page.locator('[data-layout="table"]')).toBeVisible();
    await expect(page.getByRole('columnheader')).toHaveCount(4);
  }

  const search = page.getByRole('searchbox', { name: 'Search the list' });
  await search.fill('etre');
  await expect(page.getByText('1 word')).toBeVisible();
  await expect(page.getByText('être', { exact: true })).toBeVisible();

  await search.fill('خانه');
  await expect(page.getByText('maison', { exact: true })).toBeVisible();

  await search.fill('près du parc');
  await expect(page.getByText('maison', { exact: true })).toBeVisible();
});

test('reuses one player and exposes play and pause state', async ({ page }) => {
  const first = page.getByRole('button', {
    name: 'Play pronunciation of être',
  });
  await first.click();
  await expect(
    page.getByRole('button', { name: 'Pause pronunciation of être' }),
  ).toBeVisible();

  await page
    .getByRole('button', { name: 'Play pronunciation of bonjour' })
    .click();
  await expect(
    page.getByRole('button', { name: 'Pause pronunciation of bonjour' }),
  ).toBeVisible();
  const audioState = await page.evaluate(() => {
    const instances = (
      window as unknown as {
        __audioInstances: Array<{ src: string; pauseCount: number }>;
      }
    ).__audioInstances;
    return { count: instances.length, ...instances[0] };
  });
  expect(audioState.count).toBe(1);
  expect(audioState.src).toContain('/french-1000/audio/0002-bonjour.mp3');
  expect(audioState.pauseCount).toBeGreaterThanOrEqual(2);
});

test('shows a visible no-results state', async ({ page }) => {
  await page
    .getByRole('searchbox', { name: 'Search the list' })
    .fill('zz-not-found');
  await expect(page.getByRole('status')).toContainText('No matches');
});

test('uses labelled cards and RTL Persian on a narrow viewport', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'mobile layout check');
  await expect(page.locator('[data-layout="cards"]')).toBeVisible();
  const firstCard = page.locator('article').first();
  await expect(firstCard.getByText('English')).toBeVisible();
  await expect(firstCard.getByText('Persian')).toBeVisible();
  await expect(firstCard.getByText('Example')).toBeVisible();
  await expect(firstCard.locator('[lang="fa"]')).toHaveAttribute('dir', 'rtl');
});
