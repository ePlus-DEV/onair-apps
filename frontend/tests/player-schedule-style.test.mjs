import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const file = join(process.cwd(), "components/player/Queue.vue");

test("schedule sidebar keeps rose as an accent instead of a structural fill", async () => {
  const source = await readFile(file, "utf8");

  assert.doesNotMatch(
    source,
    /tab-active !bg-rose-500 !text-white/,
    "active tabs should use the themed surface, not a full rose fill",
  );
  assert.doesNotMatch(
    source,
    /index === 0\s*\? 'bg-rose-500\/10 ring-1 ring-inset ring-rose-500\/15'/,
    "current schedule rows should not look like an alert/error block",
  );

  assert.match(
    source,
    /bg-\[var\(--radio-surface\)\]/,
  );
  assert.match(
    source,
    /absolute inset-y-2 left-0 w-0\.5 rounded-full bg-rose-500/,
  );
  assert.match(
    source,
    /bg-\[var\(--radio-surface-soft\)\] ring-1 ring-inset ring-\[var\(--radio-border\)\]/,
  );
});

test("schedule time block uses structural theme tokens", async () => {
  const source = await readFile(file, "utf8");

  assert.match(
    source,
    /rounded-lg bg-\[var\(--radio-surface\)\][^"]*text-\[var\(--radio-text\)\][^"]*ring-\[var\(--radio-border\)\]/,
  );
});


test('mobile playlist toolbar shares button styles and keeps a usable volume control', async () => {
  const player = await readFile(join(process.cwd(), 'components/player/Player.vue'), 'utf8');
  const drawer = player.slice(player.indexOf('<USlideover v-model:open="mobileQueueOpen"'), player.indexOf('</USlideover>'));
  assert.match(drawer, /grid grid-cols-2 items-stretch gap-2/);
  assert.ok((drawer.match(/radio-queue-action/g) || []).length >= 5);
  assert.match(drawer, /radio-volume radio-volume-mobile h-11 min-w-0 flex-1/);
  assert.match(drawer, /role="note" class="col-span-2/);
  assert.doesNotMatch(drawer, /flex flex-wrap items-center gap-2 border-b/);
  assert.match(player, /\.radio-queue-action \{[\s\S]*?min-height: 44px;[\s\S]*?border-radius: 12px;[\s\S]*?background: var\(--radio-surface-soft\)/);
});

test('station-row Play buttons share the accent and touch target', async () => {
  const queue = await readFile(file, 'utf8');
  assert.match(queue, /flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500\/10/);
  assert.match(queue, /group-hover:bg-rose-500\/20/);
  assert.doesNotMatch(queue, /flex h-8 w-8 shrink-0 items-center justify-center rounded-full border/);
});
