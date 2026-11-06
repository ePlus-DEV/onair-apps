import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const LOCALES = ["en-US", "vi-VN", "ja-JP", "zh-CN", "zh-TW", "fr-FR", "ru-RU"];
const read = (path) => readFile(path, "utf8");
const flatten = (object, prefix = "") =>
  Object.entries(object).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value !== null && typeof value === "object" && !Array.isArray(value)
      ? flatten(value, path)
      : [[path, value]];
  });
const placeholders = (value) =>
  [...String(value).matchAll(/\{([a-zA-Z][\w]*)\}/g)].map((match) => match[1]).sort();

test("all seven locales contain the same nonempty translation keys and interpolation variables", async () => {
  const entries = await Promise.all(
    LOCALES.map(async (locale) => {
      const text = await read(`lang/${locale}.json`);
      const parsed = JSON.parse(text);
      return { locale, values: new Map(flatten(parsed)) };
    }),
  );
  const reference = entries[0].values;
  assert.ok(reference.size >= 283, "the current UI should have at least 283 i18n leaves");

  for (const { locale, values } of entries) {
    assert.deepEqual([...values.keys()].sort(), [...reference.keys()].sort(), `${locale} translation keys differ`);
    for (const [key, value] of values) {
      assert.equal(typeof value, "string", `${locale}: ${key} must be a string`);
      assert.ok(value.trim(), `${locale}: ${key} must not be blank`);
      assert.deepEqual(placeholders(value), placeholders(reference.get(key)), `${locale}: ${key} interpolation mismatch`);
    }
  }
});

test("visible navigation, player, search and chat copy use localized keys", async () => {
  const files = {
    "pages/index.vue": ["home.title", "home.start_listening", "home.browse_country"],
    "components/AppHeader.vue": ["brand.slogan"],
    "components/AppFooter.vue": ["footer.tagline", "footer.description"],
    "components/AppSidebar.vue": ["sidebar.browse_radio", "sidebar.description"],
    "components/search/Box.vue": ["search.unavailable"],
    "components/player/Queue.vue": ["player.sidebar_label", "player.live"],
    "components/player/Playlist.vue": ["player.live"],
    "components/player/Player.vue": ["player.primary_source", "player.alternative_source", "player.source_number"],
    "components/panel/Chat.vue": ["chat.greeting", "chat.send"],
    "pages/[area]/[country]/index.vue": ["seo.country_title", "seo.country_description", "panel.station_count"],
    "pages/[area]/[country]/[station].vue": ["seo.station_title", "seo.station_description", "player.live"],
  };
  const en = new Map(flatten(JSON.parse(await read("lang/en-US.json"))));
  for (const [path, keys] of Object.entries(files)) {
    const source = await read(path);
    for (const key of keys) {
      assert.ok(en.has(key), `missing English i18n key ${key}`);
      assert.ok(source.includes(key), `${path} must use ${key}`);
    }
  }
  const page = await read("pages/index.vue");
  assert.doesNotMatch(page, />Start listening<\/a>|>Browse by country\s*<\/h2>/);
  const search = await read("components/search/Box.vue");
  assert.doesNotMatch(search, /Search service is unavailable right now/);
});

test("known misleading translations stay corrected", async () => {
  const locales = Object.fromEntries(
    await Promise.all(LOCALES.map(async (locale) => [locale, JSON.parse(await read(`lang/${locale}.json`))])),
  );
  assert.equal(locales["vi-VN"].table.commit, "Bản commit");
  assert.equal(locales["ja-JP"].button.close, "閉じる");
  assert.equal(locales["ja-JP"].table.view, "表示");
  assert.equal(locales["fr-FR"].button.back, "Retour");
  assert.equal(locales["ru-RU"].panel.lyric, "Текст песни");
  for (const locale of LOCALES) {
    assert.ok(!locales[locale].navmenu.old_version.startsWith("#"), `${locale}: old version must be a readable label`);
  }
});
