import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const playerFile = join(process.cwd(), "components/player/Player.vue");
test("player does not duplicate current song below the main now-playing area", async () => {
  const source = await readFile(playerFile, "utf8");

  assert.doesNotMatch(
    source,
    /v-if="song\?\.currentMedia"[\s\S]{0,1200}Now playing/,
    "currentMedia should not be rendered twice in the player",
  );

  assert.match(source, /v-if="song\?\.nextMedia\?\.title"/);
  assert.match(source, /\$t\("panel\.next"\)/);
  assert.match(source, /song\.nextMedia\.title/);
  assert.match(source, /song\.nextMedia\.artists/);
});

test("player palette keeps structural surfaces neutral and rose as the primary action accent", async () => {
  const source = await readFile(playerFile, "utf8");

  assert.doesNotMatch(source, /rgba\(56,189,248/);
  assert.match(source, /bg-\[var\(--radio-surface-elevated\)\]/);
  assert.match(source, /bg-rose-500 text-white[\s\S]*hover:bg-rose-400/);
  assert.match(source, /\$t\('player\.pause'\)/);
});

test("player dock is a live radio console, not a cloned music timeline", async () => {
  const source = await readFile(playerFile, "utf8");

  assert.match(source, /radio-player-console/);
  assert.match(source, /radio-player-main-action/);
  assert.match(source, /liveStateLabel/);
  assert.match(source, /activeSourceName/);
  assert.doesNotMatch(
    source,
    /nowPlayingTitle[\s\S]{0,800}<input type="range"[\s\S]{0,800}currentMedia/,
    "the dock should not add a song-progress timeline for live radio",
  );
});

test("desktop player controls remain centered regardless of station metadata lines", async () => {
  const source = await readFile(playerFile, "utf8");
  const dockMarkup = source.match(/<div class="radio-player-console [^"]+"/)?.[0];
  assert.ok(dockMarkup, "radio player grid must exist");
  assert.match(dockMarkup, /min-h-\[var\(--radio-player-height\)\]/);
  assert.match(dockMarkup, /sm:grid-cols-\[minmax\(0,1fr\)_auto_minmax\(0,1fr\)\]/);
  assert.doesNotMatch(dockMarkup, /(?:^|\s)pb-\d+/, "bottom padding offsets the controls from the dock center");
  assert.match(source, /radio-player-live-pill[^"]*whitespace-nowrap/);
  assert.match(source, /radio-player-controls[^"]*items-center justify-center/);
  assert.match(source, /radio-player-meta[^"]*truncate/);
});


test("mobile dock reserves separate columns for info, Play/Pause and Playlist", async () => {
  const source = await readFile(playerFile, "utf8");
  // Player.vue has nested <template> blocks; the first closing tag is not
  // the end of the component template. Stop at the script block instead.
  const scriptStart = source.indexOf('<script lang="ts" setup>');
  assert.ok(scriptStart > 0, "player script must follow its full template");
  const template = source.slice(0, scriptStart);
  const mobileStyles = source.match(/@media \(max-width: 639px\) \{[\s\S]*?Three real grid columns[\s\S]*?\n\}/)?.[0];

  assert.match(template, /grid-cols-\[minmax\(0,1fr\)_2\.75rem_2\.75rem\]/);
  assert.match(template, /sm:grid-cols-\[minmax\(0,1fr\)_auto_minmax\(0,1fr\)\]/);
  assert.match(template, /relative flex min-w-0 items-center gap-2\.5/);
  assert.match(template, /radio-player-title[^"]*text-xs font-semibold/);
  assert.match(template, /radio-player-meta mt-0\.5 truncate/);
  assert.match(template, /radio-player-meta mt-1 hidden truncate/);
  assert.match(template, /hidden sm:inline-flex/); // Previous and Next stay on desktop and expanded player.
  assert.match(template, /icon="i-lucide-list-music" class="h-11 w-11[^"]*" :disabled="!hasSidebar"/);
  assert.match(template, /:aria-expanded="hasSidebar && mobileQueueOpen" @click="toggleQueue"/);
  assert.match(template, /:aria-label="\$t\('redesign\.now_playing'\)" @click="nowPlayingOpen = true"/);
  assert.ok(mobileStyles, "mobile player uses a non-overlapping grid");
  assert.doesNotMatch(mobileStyles, /left:\s*50%|top:\s*50%|position:\s*absolute|padding-right:\s*6\.25rem/);
});
