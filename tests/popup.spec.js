import { test, expect, getSettings, waitForPlaying, NASA_PLAYLIST } from './fixtures.js';

const PLAYLIST_URL = `https://www.youtube.com/playlist?list=${NASA_PLAYLIST.id}`;

test.describe('未登録', () => {
  test.use({ playlist: null });

  test('新しいタブに案内文が出る', async ({ page }) => {
    await expect(page.locator('#empty')).toBeVisible();
    await expect(page.locator('#empty')).toContainText('プレイリストが登録されていません');
    await expect(page.locator('#player iframe')).toHaveCount(0);
  });

  test('ポップアップは「未登録」と表示する', async ({ popup }) => {
    await expect(popup.locator('#current-title')).toHaveText('未登録');
  });

  test('URL を貼り付けて登録すると、名前を表示して保存する', async ({ popup }) => {
    await popup.fill('#url', PLAYLIST_URL);
    await popup.click('#register');
    await expect(popup.locator('#message')).toHaveText('登録しました', { timeout: 15_000 });
    await expect(popup.locator('#current-title')).toHaveText(NASA_PLAYLIST.title);
    expect(await getSettings(popup)).toMatchObject({ playlistId: NASA_PLAYLIST.id, playlistTitle: NASA_PLAYLIST.title });
  });

  test('動画ページの URL（watch?v=...&list=...）でも登録できる', async ({ popup }) => {
    await popup.fill('#url', `https://www.youtube.com/watch?v=Sv3eXRN7hLo&list=${NASA_PLAYLIST.id}`);
    await popup.click('#register');
    await expect(popup.locator('#message')).toHaveText('登録しました', { timeout: 15_000 });
    expect((await getSettings(popup)).playlistId).toBe(NASA_PLAYLIST.id);
  });

  test('プレイリストではない URL は登録しない', async ({ popup }) => {
    await popup.fill('#url', 'https://www.youtube.com/watch?v=Sv3eXRN7hLo');
    await popup.click('#register');
    await expect(popup.locator('#message')).toHaveClass('error');
    expect((await getSettings(popup)).playlistId).toBeUndefined();
  });

  test('存在しないプレイリストは登録しない', async ({ popup }) => {
    await popup.fill('#url', 'https://www.youtube.com/playlist?list=PLxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
    await popup.click('#register');
    await expect(popup.locator('#message')).toContainText('見つかりません', { timeout: 15_000 });
    expect((await getSettings(popup)).playlistId).toBeUndefined();
  });

  test('登録すると、開いている新しいタブが再生を始める', async ({ page, popup }) => {
    await expect(page.locator('#empty')).toBeVisible();
    await popup.fill('#url', PLAYLIST_URL);
    await popup.click('#register');
    await expect(page.locator('#empty')).toBeHidden();
    // 実際の使い方と同じく、裏で読み込み直された新しいタブを表に出す
    await page.bringToFront();
    await waitForPlaying(page);
  });
});

test.describe('登録済み', () => {
  test('登録中のプレイリスト名を表示する', async ({ page, popup }) => {
    await expect(popup.locator('#current-title')).toHaveText(NASA_PLAYLIST.title);
  });

  test('YouTube 以外のタブでは「このプレイリストを使う」を押せない', async ({ popup }) => {
    await expect(popup.locator('#use-tab')).toBeDisabled();
    await expect(popup.locator('#use-tab-note')).toBeVisible();
  });

  test('再生順を切り替えると保存し、開き直しても残る', async ({ popup }) => {
    await expect(popup.locator('input[value="shuffle"]')).toBeChecked();
    await popup.click('text=連続再生');
    await expect.poll(async () => (await getSettings(popup)).shuffle).toBe(false);
    await popup.reload();
    await expect(popup.locator('input[value="sequential"]')).toBeChecked();
  });

  test('ぼかしと暗さを変えると、開いている新しいタブにその場で反映する', async ({ page, popup }) => {
    await waitForPlaying(page);
    const cssVar = (name) =>
      page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);

    await popup.locator('#blur').fill('4');
    await expect(popup.locator('#blur-value')).toHaveText('4');
    await expect.poll(() => cssVar('--blur')).toBe('4px');

    await popup.locator('#dim').fill('60');
    await expect(popup.locator('#dim-value')).toHaveText('60%');
    await expect.poll(() => cssVar('--dim')).toBe('0.6');
  });
});
