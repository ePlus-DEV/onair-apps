import { test, expect } from '@playwright/test';

const queue = page => page.locator('.radio-right-panel');
const scrollArea = page => queue(page).locator('.radio-scrollbar[tabindex="0"]');
const visibleCurrent = page => queue(page).locator('[data-program-index="6"]'); // HCM FM91 at 14:30.

test('VOV Giao thông guide opens at the current Vietnam programme, not the first row', async ({ page }) => {
  await page.setViewportSize({ width: 1536, height: 900 });
  // 08:00 UTC = 15:00 Vietnam time, inside the 14:30–16:15 reference slot.
  await page.clock.install({ time: new Date('2026-10-14T08:00:00Z') });
  await page.goto('/asia/viet-nam/vov-gt-hcm');
  await page.waitForFunction(() => Boolean(document.querySelector('#__nuxt')?.__vue_app__));
  await page.locator('.radio-player-dock').getByRole('button', { name: 'Channels & schedule' }).click();
  await expect(queue(page)).toBeVisible();
  await queue(page).getByRole('tab', { name: /Schedule/ }).click();

  const scroll = scrollArea(page);
  const current = visibleCurrent(page);
  await expect(current).toBeVisible();
  await expect(current).toContainText('FM91');
  await expect(queue(page).locator('[data-schedule-timeline]')).toBeVisible();
  await expect(current).toHaveAttribute('style', /height: 133px/);
  await expect(queue(page).locator('[data-schedule-now]')).toContainText('15:00:00');
  await expect.poll(() => scroll.evaluate(element => element.scrollTop)).toBeGreaterThan(40);
  await expect.poll(() => current.evaluate(row => {
    const viewport = row.closest('.radio-scrollbar').getBoundingClientRect();
    const target = row.getBoundingClientRect();
    return target.top >= viewport.top && target.bottom <= viewport.bottom;
  })).toBe(true);

  // A manual browse is never snapped back by a routine clock tick.
  await scroll.evaluate(element => { element.scrollTop = 0; });
  await scroll.dispatchEvent('wheel', { deltaY: -200, bubbles: true });
  await page.clock.runFor(31_000);
  expect(await scroll.evaluate(element => element.scrollTop)).toBe(0);

  // An explicit "jump to now" button restores the active row.
  await queue(page).getByRole('button', { name: 'Jump to current time' }).click();
  await expect.poll(() => scroll.evaluate(element => element.scrollTop)).toBeGreaterThan(40);

  // Switching away and back to Schedule must center the active row again.
  await queue(page).getByRole('tab', { name: /All channels/ }).click();
  await scroll.evaluate(element => { element.scrollTop = 0; });
  await queue(page).getByRole('tab', { name: /Schedule/ }).click();
  await expect.poll(() => scroll.evaluate(element => element.scrollTop)).toBeGreaterThan(40);
});

test('16:29 ICT draws a moving green NOW line across an empty time gap', async ({ page }) => {
  await page.setViewportSize({ width: 1536, height: 900 });
  await page.clock.install({ time: new Date('2026-10-14T09:29:00Z') });
  await page.goto('/asia/viet-nam/vov-gt-hcm');
  await page.waitForFunction(() => Boolean(document.querySelector('#__nuxt')?.__vue_app__));
  await page.locator('.radio-player-dock').getByRole('button', { name: 'Channels & schedule' }).click();
  await queue(page).getByRole('tab', { name: /Schedule/ }).click();

  const timeline = queue(page).locator('[data-schedule-timeline]');
  const marker = timeline.locator('[data-schedule-now]');
  const unknown = timeline.locator('[data-schedule-gap]');
  await expect(timeline).toBeVisible();
  await expect(marker).toContainText('16:29:00');
  await expect(unknown).toContainText('No programme details are listed for this time');
  await expect(unknown).toContainText('Giờ cao điểm chiều');
  await expect(unknown).toContainText('16:30');
  await expect.poll(() => marker.evaluate(row => {
    const viewport = row.closest('.radio-scrollbar').getBoundingClientRect();
    const box = row.getBoundingClientRect();
    return box.top >= viewport.top && box.top <= viewport.bottom;
  })).toBe(true);

  const nextSlot = timeline.locator('[data-program-index="7"]');
  await expect(nextSlot).not.toHaveClass(/bg-rose-950\/\[0\.88\]/);
  const firstTop = await marker.evaluate(element => parseFloat(element.style.top));
  await page.clock.runFor(30_000);
  await expect(marker).toContainText('16:29:30');
  expect(await marker.evaluate(element => parseFloat(element.style.top))).toBeGreaterThan(firstTop);

  await page.clock.runFor(30_000);
  await expect(unknown).toHaveCount(0);
  await expect(marker).toContainText('16:30:00');
  await expect(nextSlot).toHaveClass(/bg-rose-950/);
});

test('manual browsing in a missing-guide window does not get auto-recentered', async ({ page }) => {
  await page.setViewportSize({ width: 1536, height: 900 });
  await page.clock.install({ time: new Date('2026-10-14T04:30:00Z') }); // 11:30 ICT
  await page.goto('/asia/viet-nam/vov-gt-hcm');
  await page.waitForFunction(() => Boolean(document.querySelector('#__nuxt')?.__vue_app__));
  await page.locator('.radio-player-dock').getByRole('button', { name: 'Channels & schedule' }).click();
  await queue(page).getByRole('tab', { name: /Schedule/ }).click();

  const scroll = scrollArea(page);
  const marker = queue(page).locator('[data-schedule-now]');
  await expect(marker).toContainText('11:30:00');
  await expect(queue(page).locator('[data-schedule-gap]')).toContainText('12:30');
  await scroll.evaluate(node => { node.scrollTop = 0; });
  await scroll.dispatchEvent('wheel', { deltaY: -200, bubbles: true });
  await page.clock.runFor(16_000);
  expect(await scroll.evaluate(node => node.scrollTop)).toBe(0);
  await queue(page).getByRole('button', { name: 'Jump to current time' }).click();
  await expect.poll(() => scroll.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
});

test('1-second time bar moves during an unlisted gap and transfers into scheduled show', async ({ page }) => {
  await page.setViewportSize({ width: 1536, height: 900 });
  await page.clock.install({ time: new Date('2026-10-14T09:29:00Z') });
  await page.goto('/asia/viet-nam/vov-gt-hcm');
  await page.waitForFunction(() => Boolean(document.querySelector('#__nuxt')?.__vue_app__));
  await page.locator('.radio-player-dock').getByRole('button', { name: 'Channels & schedule' }).click();
  await queue(page).getByRole('tab', { name: /Schedule/ }).click();

  const marker = queue(page).locator('[data-schedule-now]');
  const time = marker.locator('[data-schedule-clock]');
  const line = marker.locator('[data-schedule-time-progress]');
  await expect(time).toHaveText('16:29:00');
  const initialProgress = await line.evaluate(element => parseFloat(element.style.width));
  expect(initialProgress).toBeCloseTo(93.333, 1);

  await page.clock.runFor(2_000);
  await expect(time).toHaveText('16:29:02');
  const advancedProgress = await line.evaluate(element => parseFloat(element.style.width));
  expect(advancedProgress).toBeGreaterThan(initialProgress);

  await page.clock.runFor(58_000); // Exactly 16:30 ICT.
  await expect(marker).toHaveCount(0);
  const programme = queue(page).locator('[data-program-index="7"]');
  await expect(programme.locator('[data-schedule-clock]')).toContainText('16:30:00');
  const showProgress = programme.locator('[data-schedule-time-progress]');
  await expect(showProgress).toHaveCount(1);
  expect(await showProgress.evaluate(element => parseFloat(element.style.width))).toBe(0);
  await page.clock.runFor(2_000);
  expect(await showProgress.evaluate(element => parseFloat(element.style.width))).toBeGreaterThan(0);
});
