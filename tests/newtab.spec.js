import { test, expect, debug, waitForPlaying } from './fixtures.js';

test.beforeEach(async ({ page }) => {
  await waitForPlaying(page);
});

test.describe('再生', () => {
  test('再生が始まり、パネルに動画名が出る', async ({ page }) => {
    await expect(page.locator('#panel')).toBeVisible();
    await expect(page.locator('#title')).not.toBeEmpty();
    await expect(page.locator('#title')).toHaveAttribute('href', /^https:\/\/www\.youtube\.com\/watch\?v=/);
    await expect(debug.log(page)).toContainText('シャッフル=true');
  });

  test('「次へ」で動画が変わる', async ({ page }) => {
    const before = await page.locator('#title').textContent();
    await page.click('#next');
    await expect(page.locator('#title')).not.toHaveText(before, { timeout: 15_000 });
  });

  test('最後の動画の次は、最初の動画に戻る', async ({ page }) => {
    await page.click('#last');
    await expect(debug.index(page)).toHaveText(/^(\d+) \/ \1$/, { timeout: 15_000 });
    await page.click('#next');
    await expect(debug.index(page)).toHaveText(/^1 \/ \d+$/, { timeout: 15_000 });
  });

  test('裏に回ると一時停止し、表示されると再開する', async ({ page }) => {
    // ヘッドレスではタブが裏に回らないので、document.hidden を差し替えてイベントを送る
    const setHidden = (hidden) =>
      page.evaluate((h) => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
        document.dispatchEvent(new Event('visibilitychange'));
      }, hidden);

    await setHidden(true);
    await expect(debug.log(page).locator('li').first()).toContainText('onStateChange: 2', { timeout: 10_000 });
    await setHidden(false);
    await expect(debug.log(page).locator('li').first()).toContainText('onStateChange: 1', { timeout: 10_000 });
  });
});

test.describe('見た目', () => {
  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 800, height: 1000 }, // 縦長
    { width: 1600, height: 500 }, // 横長
  ]) {
    test(`黒帯なしで画面を覆う（${viewport.width}x${viewport.height}）`, async ({ page }) => {
      await page.setViewportSize(viewport);
      const box = await page.locator('#player iframe').boundingBox();
      expect(box.x).toBeLessThanOrEqual(0);
      expect(box.y).toBeLessThanOrEqual(0);
      expect(box.x + box.width).toBeGreaterThanOrEqual(viewport.width);
      expect(box.y + box.height).toBeGreaterThanOrEqual(viewport.height);
    });
  }

  test('再生が始まってから約 5 秒は動画を隠し、そのあと表示する', async ({ page }) => {
    // YouTube が再生直後に出すボタンを見せないため
    await expect(page.locator('body')).not.toHaveClass(/video-visible/);
    await page.waitForTimeout(3000);
    await expect(page.locator('body')).not.toHaveClass(/video-visible/);
    await expect(page.locator('body')).toHaveClass(/video-visible/, { timeout: 5000 });
    await expect(page.locator('#player iframe')).toHaveCSS('opacity', '1', { timeout: 3000 });
  });

  test('動画の終わりで暗くし、次の動画が始まってから表示する', async ({ page }) => {
    await expect(page.locator('body')).toHaveClass(/video-visible/, { timeout: 10_000 });
    const title = await page.locator('#title').textContent();
    await page.click('#near-end'); // 残り 5 秒へ
    // 飛んだ先の読み込み（4K だと数秒かかる）を待つ分、長めに待つ
    await expect(page.locator('body')).not.toHaveClass(/video-visible/, { timeout: 15_000 });
    await expect(page.locator('#title')).not.toHaveText(title, { timeout: 10_000 });
    await expect(page.locator('body')).toHaveClass(/video-visible/, { timeout: 10_000 });
  });

  test('裏から戻ったときも、約 5 秒は動画を隠す', async ({ page }) => {
    await expect(page.locator('body')).toHaveClass(/video-visible/, { timeout: 10_000 });
    const setHidden = (hidden) =>
      page.evaluate((h) => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
        document.dispatchEvent(new Event('visibilitychange'));
      }, hidden);
    await setHidden(true);
    await expect(page.locator('body')).not.toHaveClass(/video-visible/, { timeout: 5000 });
    await setHidden(false);
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).not.toHaveClass(/video-visible/);
    await expect(page.locator('body')).toHaveClass(/video-visible/, { timeout: 6000 });
  });

  test('動画はマウス操作に反応しない', async ({ page }) => {
    await expect(page.locator('#player iframe')).toHaveCSS('pointer-events', 'none');
  });

  test('長い動画名だけ横スクロールする', async ({ page }) => {
    const { overflow, scrolling } = await page.evaluate(() => ({
      overflow: document.getElementById('title').scrollWidth > document.getElementById('title-box').clientWidth,
      scrolling: document.getElementById('title').classList.contains('scrolling'),
    }));
    expect(scrolling).toBe(overflow);
  });
});

test.describe('音', () => {
  test('音量の初期値は 50', async ({ page }) => {
    await expect(debug.volume(page)).toHaveText('50');
    await expect(page.locator('#volume')).toHaveValue('50');
  });

  test('変えた音量は保存し、次に開いた新しいタブで使う', async ({ page, context, extensionId }) => {
    await page.locator('#volume').fill('30');
    await expect(debug.volume(page)).toHaveText('30');

    const next = await context.newPage();
    await next.goto(`chrome-extension://${extensionId}/newtab.html`);
    await waitForPlaying(next);
    await expect(debug.volume(next)).toHaveText('30');
    await expect(next.locator('#volume')).toHaveValue('30');
    // 新しいタブも、ミュートで始まる
    await expect(debug.muted(next)).toHaveText('ミュート中');
  });

  test('音量は、開いている他の新しいタブには反映しない', async ({ page, context, extensionId }) => {
    const other = await context.newPage();
    await other.goto(`chrome-extension://${extensionId}/newtab.html`);
    await waitForPlaying(other);

    await page.bringToFront();
    await page.locator('#volume').fill('20');
    await expect(debug.volume(page)).toHaveText('20');
    await page.waitForTimeout(1000);
    await expect(debug.volume(other)).toHaveText('50');
  });

  test('スピーカーでミュートを切り替え、アイコンも変わる', async ({ page }) => {
    await expect(debug.muted(page)).toHaveText('ミュート中');
    await expect(page.locator('#icon-muted')).toBeVisible();

    await page.click('#mute');
    await expect(debug.muted(page)).toHaveText('音あり');
    await expect(page.locator('#icon-sound')).toBeVisible();
    await expect(page.locator('#mute')).toHaveAttribute('aria-label', 'ミュート');

    await page.click('#mute');
    await expect(debug.muted(page)).toHaveText('ミュート中');
    await expect(page.locator('#icon-muted')).toBeVisible();
  });

  test('スピーカーを連打しても、押した回数どおりになる', async ({ page }) => {
    await page.click('#mute');
    await page.click('#mute');
    await page.waitForTimeout(2000); // 返事が出そろうのを待つ
    await expect(debug.muted(page)).toHaveText('ミュート中');
    await expect(page.locator('#icon-muted')).toBeVisible();
  });

  test('ミュート中にスライダーを動かすと、ミュートも解除する', async ({ page }) => {
    await page.locator('#volume').fill('40');
    await expect(debug.muted(page)).toHaveText('音あり');
    await expect(debug.volume(page)).toHaveText('40');
  });

  test('音量 0 はミュートのアイコンになり、スピーカーを押しても何もしない', async ({ page }) => {
    await page.locator('#volume').fill('40');
    await expect(debug.volume(page)).toHaveText('40');
    await page.locator('#volume').fill('0');
    await expect(debug.volume(page)).toHaveText('0');
    await expect(page.locator('#icon-muted')).toBeVisible();

    await page.click('#mute');
    await page.waitForTimeout(2000);
    await expect(debug.volume(page)).toHaveText('0');
  });

  test('ミュート中にスライダーを 0 にしても、音量が 5 にならない', async ({ page }) => {
    await page.locator('#volume').fill('0');
    await page.waitForTimeout(2000);
    await expect(debug.volume(page)).toHaveText('0');
    await expect(debug.muted(page)).toHaveText('ミュート中');
  });
});
