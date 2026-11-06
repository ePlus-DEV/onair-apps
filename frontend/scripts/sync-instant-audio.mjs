#!/usr/bin/env node

import { appendFile, mkdir, readFile, writeFile, access, unlink, copyFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { stripMarkupToText } from "../utils/markup-text.mjs";

const ROOT = process.cwd();
const INSTANT_HOME = "https://instant.audio/";
const API_BASE = "https://api.instant.audio/data/streams";
const RADIO_BROWSER_BASE =
  "https://de1.api.radio-browser.info/json/stations/bycountrycodeexact";
const MWYNIKI_BASE = "https://www.mwyniki.pl";
const MWYNIKI_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36";
const USER_AGENT =
  "ePlus-OnAir-Data-Sync/2.0 (+https://github.com/ePlus-DEV/radio.eplus.dev)";
const DEFAULT_STATION_IMAGE = "https://s3.eplus.dev/i/station-on-air.png";
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const STATION_ARTWORK_WIDTH = 96;
const STATION_ARTWORK_HEIGHT = 66;
const STATION_ARTWORK_BACKUP_ROOT = path.join(ROOT, "backup", "station-artwork");
const IMAGE_EXTENSIONS = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
  ["image/svg+xml", "svg"],
  ["image/avif", "avif"]
]);

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...value] = arg.replace(/^--/, "").split("=");
    return [key, value.length ? value.join("=") : "true"];
  }),
);

const dryRun = args.get("dry-run") === "true";
const refreshExisting = args.get("refresh-existing") === "true";
const flagsOnly = args.get("flags-only") === "true";
const requestedCountry = args.get("country") || "";
const maxCountries = Math.max(1, Number(args.get("max-countries") || 3));
const maxStations = Math.max(0, Number(args.get("max-stations") || 0));

let directApiBlockedForRun = false;

const runStats = {
  countriesSucceeded: 0,
  countriesFailed: 0,
  stationsDiscovered: 0,
  stationsAdded: 0,
  imagesDownloaded: 0,
  imagesExisting: 0,
  imagesFallback: 0,
  artworkNeedsReprocess: 0,
  imageCandidateFailures: 0,
  homepageArtworkFailures: 0,
  countries: [],
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const COUNTRY_ALIASES = {
  "haïti": "haiti",
  "méxico": "mexico",
  "república dominicana": "dominican-republic",
  "panamá": "panama",
  "perú": "peru",
  "brasil": "brazil",
  "belgië": "belgium",
  "česká republika": "czechia",
  "deutschland": "germany",
  "eesti": "estonia",
  "españa": "spain",
  "hellas": "greece",
  "hrvatska": "croatia",
  "italia": "italy",
  "latvija": "latvia",
  "lëtzebuerg": "luxembourg",
  "lietuva": "lithuania",
  "magyarország": "hungary",
  "nederland": "netherlands",
  "norge": "norway",
  "österreich": "austria",
  "polska": "poland",
  "românia": "romania",
  "schweiz": "switzerland",
  "slovenija": "slovenia",
  "srbija": "serbia",
  "suomi": "finland",
  "sverige": "sweden",
  "българия": "bulgaria",
  "україна": "ukraine",
  "algérie": "algeria",
  "côte d'ivoire": "cote-d-ivoire",
  "madagasikara": "madagascar",
  "maroc": "morocco",
  "misr": "egypt",
  "sénégal": "senegal",
  "tunisie": "tunisia",
  "hanguk": "korea",
  "nepāla": "nepal",
  "nihon": "japan",
  "sri lankā": "sri-lanka",
  "việt nam": "viet-nam",
  "יִשְׂרָאֵל‎": "israel",
  "ประเทศไทย": "thailand",
  "中国": "china",
  "台灣": "taiwan"
};

const AREA_ALIASES = {
  "north america": "north-america",
  "central america": "central-america",
  "south america": "south-america",
  europe: "europe",
  africa: "africa",
  asia: "asia",
  oceania: "oceania"
};

const RESERVED_PATHS = new Set([
  "about",
  "acerca",
  "apps",
  "buscar",
  "contacto",
  "dmca",
  "favorites",
  "favoritos",
  "favourites",
  "generos",
  "genres",
  "help",
  "include-your-radio",
  "incluir-tu-radio",
  "menu",
  "privacy-policy",
  "recently-played",
  "escuchado-recientemente",
  "search"
]);

const LOCALES = {
  "en-US.json": "en",
  "vi-VN.json": "vi",
  "ja-JP.json": "ja",
  "zh-CN.json": "zh-CN",
  "zh-TW.json": "zh-TW",
  "fr-FR.json": "fr",
  "ru-RU.json": "ru"
};

function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function countrySlug(label) {
  const key = label.trim().toLowerCase();
  return COUNTRY_ALIASES[key] || slugify(label);
}

async function exists(file) {
  try {
    await access(file, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function fetchWithRetry(url, options = {}, attempts = 3) {
  let lastError;
  const timeoutMs = Number(options.timeoutMs || 12000);
  const fetchOptions = { ...options };
  delete fetchOptions.timeoutMs;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: "follow",
        headers: {
          "user-agent": USER_AGENT,
          accept: "*/*",
          ...(fetchOptions.headers || {})
        },
        ...fetchOptions,
        signal: fetchOptions.signal || AbortSignal.timeout(timeoutMs),
      });

      if (response.ok) return response;
      lastError = new Error(`${response.status} ${response.statusText} for ${url}`);
      lastError.status = response.status;

      if (![429, 500, 502, 503, 504].includes(response.status)) {
        throw lastError;
      }
    } catch (error) {
      lastError = error;
    }

    if (attempt < attempts) {
      await sleep(500 * attempt);
    }
  }

  throw lastError;
}

async function fetchTextSource(url) {
  try {
    const response = await fetchWithRetry(url, {
      headers: { accept: "text/html,application/xhtml+xml" }
    });

    return {
      text: await response.text(),
      response,
      via: "direct"
    };
  } catch (directError) {
    const readerUrl = `https://r.jina.ai/${url}`;
    const response = await fetchWithRetry(readerUrl, {
      headers: { accept: "text/plain,text/markdown" }
    });

    return {
      text: await response.text(),
      response: null,
      via: "reader",
      directError
    };
  }
}

function discoverCountries(source) {
  const countries = [];
  let area = "";

  for (const line of source.split(/\r?\n/)) {
    const headingMatch = line.match(/^#{1,6}\s+(.+?)\s*$/);
    if (headingMatch) {
      const heading = stripMarkupToText(headingMatch[1]).toLowerCase();
      if (AREA_ALIASES[heading]) area = AREA_ALIASES[heading];
      continue;
    }

    if (!area) continue;

    const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
    let linkMatch;

    while ((linkMatch = linkRegex.exec(line))) {
      const label = stripMarkupToText(linkMatch[1]);
      if (!label) continue;

      let url;
      try {
        url = new URL(linkMatch[2]);
      } catch {
        continue;
      }

      if (
        url.hostname === "instant.audio" ||
        url.hostname.endsWith(".instant.audio")
      ) {
        continue;
      }

      countries.push({
        area,
        label,
        slug: countrySlug(label),
        domain: url.origin
      });
    }
  }

  return [
    ...new Map(
      countries.map((item) => [`${item.area}/${item.slug}`, item]),
    ).values(),
  ];
}

function extractCountryId(response, html) {
  const linkHeader = response?.headers?.get("link") || "";
  const combined = `${linkHeader}\n${html}`;
  const match = combined.match(
    /https:\/\/api\.instant\.audio\/data\/streams\/(\d+)\/[a-z0-9-]+/i,
  );
  return match?.[1] || "";
}

function extractWebradioConfig(source = "") {
  const countryCode =
    source.match(/countryCode\s*:\s*["']([A-Z]{2})["']/)?.[1] || "";
  const domainID =
    source.match(/domainID\s*:\s*(\d+)/)?.[1] || "";
  const languageCode =
    source.match(/languageCode\s*:\s*["']([^"']+)["']/)?.[1] || "";

  return { countryCode, domainID, languageCode };
}

export function extractStationCandidates(source, origin) {
  const candidates = new Map();

  const addCandidate = (href, label, { trustedStationList = false } = {}) => {
    let url;
    try {
      url = new URL(href, origin);
    } catch {
      return;
    }

    if (url.origin !== origin) return;

    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length !== 1) return;

    const slug = segments[0].toLowerCase();
    if (!slug || !/^[a-z0-9-]+$/.test(slug)) return;
    if (!trustedStationList && RESERVED_PATHS.has(slug)) return;

    const imageMatch = String(label || "").match(
      /<img\b[^>]*src=["']([^"']+)["'][^>]*>/i,
    );
    let imageUrl = "";
    if (imageMatch?.[1]) {
      try {
        imageUrl = new URL(imageMatch[1], origin).toString();
      } catch {
        imageUrl = "";
      }
    }

    candidates.set(slug, {
      slug,
      title: stripMarkupToText(label || "") || slug.replace(/-/g, " "),
      pageUrl: `${origin}/${slug}/`,
      ...(imageUrl ? { imageUrl } : {})
    });
  };

  // Preferred source: the actual station navigation list rendered by InstantAudio sites.
  // This avoids false positives such as privacy/help pages and preserves valid station
  // slugs such as /contact/ (Radio Contact).
  const stationListMatch = source.match(
    /<ul\b[^>]*id=["']dynamic-radio-stations["'][^>]*>([\s\S]*?)<\/ul>/i,
  );

  if (stationListMatch) {
    const anchorRegex = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = anchorRegex.exec(stationListMatch[1]))) {
      addCandidate(match[1], match[2], { trustedStationList: true });
    }

    if (candidates.size) return [...candidates.values()];
  }

  // Fallback for other country-site templates and Jina markdown snapshots.
  const anchorRegex = new RegExp(
    `<a\\b[^>]*href=["']([^"'#]+)["'][^>]*>([\\s\\S]*?)</a>`,
    "gi",
  );
  let match;

  while ((match = anchorRegex.exec(source))) {
    addCandidate(match[1], match[2]);
  }

  const markdownLinkRegex = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
  while ((match = markdownLinkRegex.exec(source))) {
    addCandidate(match[2], match[1]);
  }

  return [...candidates.values()];
}

function collectStringCandidates(value, keyPath = [], output = []) {
  if (typeof value === "string") {
    if (/^https?:\/\//i.test(value)) {
      output.push({ url: value, keyPath: keyPath.join(".").toLowerCase() });
    }
    return output;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      collectStringCandidates(item, [...keyPath, String(index)], output),
    );
    return output;
  }

  if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      collectStringCandidates(nested, [...keyPath, key], output);
    }
  }

  return output;
}

function streamScore(candidate) {
  const { url, keyPath } = candidate;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return -999;
  }

  if (
    /(?:cdn|coverart)\.instant\.audio$/i.test(parsed.hostname) ||
    /^api\.instant\.audio$/i.test(parsed.hostname)
  ) {
    return -999;
  }

  if (/\.(?:png|jpe?g|gif|svg|webp|ico)(?:$|\?)/i.test(parsed.pathname)) {
    return -999;
  }

  let score = 0;
  if (/stream|source|audio|listen|playback/.test(keyPath)) score += 8;
  if (/(?:^|\.)url$|src|file/.test(keyPath)) score += 3;
  if (/image|logo|art|website|facebook|twitter|instagram/.test(keyPath)) score -= 12;
  if (/\.(?:m3u8|mp3|aac|ogg|opus|m3u|pls)(?:$|\?)/i.test(url)) score += 10;
  if (/stream|listen|live|radio|icecast|shoutcast/i.test(url)) score += 4;
  if (/\.html?(?:$|\?)/i.test(url)) score -= 10;

  return score;
}

function findStreamUrl(payload) {
  const candidates = collectStringCandidates(payload)
    .map((candidate) => ({ ...candidate, score: streamScore(candidate) }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score);

  return candidates[0]?.url || "";
}

export function findInstantAudioStreams(payload) {
  const result = payload?.result || payload || {};
  const streams = Array.isArray(result.streams) ? result.streams : [];
  const candidates = [];
  const seen = new Set();

  const add = (url, mime = "", source = "instant-audio") => {
    const value = String(url || "").trim();
    if (!/^https?:\/\//i.test(value)) return;
    const key = normalizeStreamIdentity(value);
    if (!key || seen.has(key)) return;
    seen.add(key);
    candidates.push({
      url: value,
      type: mime || detectMime(value),
      cros: value.startsWith("http://"),
      source,
    });
  };

  const playable = streams
    .filter((item) => {
      if (!item || item.isContainer === true || !/^https?:\/\//i.test(item.url || "")) {
        return false;
      }

      const mime = String(item.mime || "").toLowerCase();
      const mediaType = String(item.mediaType || "").toLowerCase();
      return (
        mime.startsWith("audio/") ||
        ["mp3", "aac", "ogg", "opus", "hls"].includes(mediaType)
      );
    })
    .sort((a, b) => {
      const aHttps = String(a.url).startsWith("https://") ? 1 : 0;
      const bHttps = String(b.url).startsWith("https://") ? 1 : 0;
      return bHttps - aHttps;
    });

  for (const item of playable) {
    add(item.url, item.mime || detectMime(item.url));
  }

  const fallback = findStreamUrl(payload);
  if (fallback) add(fallback, detectMime(fallback), "instant-audio-fallback");

  return candidates;
}

function findInstantAudioStream(payload) {
  const [first] = findInstantAudioStreams(payload);
  return first
    ? { url: first.url, mime: first.type }
    : null;
}

export function normalizeStationStreams(station = {}) {
  const result = [];
  const seen = new Set();

  const add = (candidate, defaultSource = "existing") => {
    const raw = typeof candidate === "string" ? { url: candidate } : candidate || {};
    const url = String(raw.url || "").trim();
    if (!/^https?:\/\//i.test(url)) return;
    const key = normalizeStreamIdentity(url);
    if (!key || seen.has(key)) return;
    seen.add(key);
    result.push({
      url,
      type: raw.type || raw.mime || detectMime(url),
      cros: typeof raw.cros === "boolean" ? raw.cros : url.startsWith("http://"),
      source: raw.source || defaultSource,
    });
  };

  if (station.stream) {
    add({
      url: station.stream,
      type: station.type,
      cros: station.cros,
      source: station.source || "primary",
    });
  }

  for (const candidate of Array.isArray(station.streams) ? station.streams : []) {
    add(candidate);
  }

  return result;
}

function findTextField(payload, fieldNames) {
  const wanted = new Set(fieldNames.map((field) => field.toLowerCase()));
  const queue = [payload];

  while (queue.length) {
    const value = queue.shift();
    if (!value || typeof value !== "object") continue;

    for (const [key, nested] of Object.entries(value)) {
      if (
        wanted.has(key.toLowerCase()) &&
        typeof nested === "string" &&
        nested.trim()
      ) {
        return nested.trim();
      }

      if (nested && typeof nested === "object") queue.push(nested);
    }
  }

  return "";
}

function detectMime(streamUrl) {
  const value = streamUrl.toLowerCase();
  if (value.includes(".m3u8")) return "application/x-mpegURL";
  if (value.includes(".aac")) return "audio/aac";
  if (value.includes(".ogg")) return "audio/ogg";
  if (value.includes(".opus")) return "audio/opus";
  return "audio/mpeg";
}

async function getCountryMetadata(country) {
  const query = country.slug.replace(/-/g, " ");
  try {
    const response = await fetchWithRetry(
      `https://restcountries.com/v3.1/name/${encodeURIComponent(query)}?fullText=true&fields=cca2,flags,timezones,name`,
      { headers: { accept: "application/json" } },
    );
    const payload = await response.json();
    const item = Array.isArray(payload) ? payload[0] : payload;

    return {
      cca2: item?.cca2 || country.cca2 || "",
      timezone: item?.timezones?.[0] || "",
      commonName: item?.name?.common || country.label
    };
  } catch (error) {
    console.warn(`REST Countries lookup failed for ${country.slug}: ${error.message}`);
    return {
      cca2: country.cca2 || "",
      timezone: "",
      commonName: country.label
    };
  }
}

export function polishSlug(value = "") {
  const polishMap = {
    "ą": "a",
    "ć": "c",
    "ę": "e",
    "ł": "l",
    "ń": "n",
    "ó": "o",
    "ś": "s",
    "ź": "z",
    "ż": "z",
  };

  return String(value)
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (char) => polishMap[char] || char)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getMwynikiCountryPage(country, metadata = {}) {
  let polishName = "";
  const countryCode = String(metadata.cca2 || country.cca2 || "").toUpperCase();

  if (countryCode) {
    try {
      polishName =
        new Intl.DisplayNames(["pl"], { type: "region" }).of(countryCode) || "";
    } catch {
      // Fall through to the canonical country name.
    }
  }

  const slug = polishSlug(
    polishName ||
    metadata.commonName ||
    country.label ||
    country.slug,
  );

  return slug
    ? `${MWYNIKI_BASE}/${slug}/`
    : "";
}

export function extractMwynikiFlagUrl(html, pageUrl) {
  const source = String(html || "");
  const imageRegex = /<img\b[^>]*>/gi;
  let match;

  while ((match = imageRegex.exec(source))) {
    const tag = match[0];
    const src =
      tag.match(/\bsrc=["']([^"']+)["']/i)?.[1] ||
      tag.match(/\bdata-src=["']([^"']+)["']/i)?.[1] ||
      "";

    if (!src || !/\/images\/responsive\/flags\/\d+\.png(?:[?#].*)?$/i.test(src)) {
      continue;
    }

    try {
      return new URL(src, pageUrl).toString();
    } catch {
      return "";
    }
  }

  return "";
}

async function findExistingFlag(country) {
  const base = path.join(ROOT, "public", "img", country.area, "flags");
  for (const extension of ["png", "svg", "webp", "jpg", "jpeg"]) {
    const destination = path.join(base, `${country.slug}.${extension}`);
    if (await exists(destination)) {
      return `/img/${country.area}/flags/${country.slug}.${extension}`;
    }
  }
  return "";
}

async function downloadFlag(country, metadata) {
  const relative = `/img/${country.area}/flags/${country.slug}.png`;
  const destination = path.join(ROOT, "public", relative);

  if (await exists(destination)) return relative;
  if (dryRun) return relative;

  const existingFlag = await findExistingFlag(country);
  const pageUrl = getMwynikiCountryPage(country, metadata);

  if (!pageUrl) {
    console.warn(`[instant.audio] Unable to build mWyniki flag page for ${country.slug}`);
    return existingFlag;
  }

  try {
    const pageResponse = await fetchWithRetry(pageUrl, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "accept-language": "pl-PL,pl;q=0.9,en;q=0.8",
        "user-agent": MWYNIKI_USER_AGENT,
      }
    });

    const pageHtml = await pageResponse.text();
    const flagUrl = extractMwynikiFlagUrl(pageHtml, pageUrl);

    if (!flagUrl) {
      throw new Error("mWyniki page did not expose a country logo");
    }

    const response = await fetchWithRetry(flagUrl, {
      headers: {
        accept: "image/png,image/*;q=0.8",
        referer: pageUrl,
        "user-agent": MWYNIKI_USER_AGENT,
      }
    });

    const contentType = response.headers.get("content-type") || "";
    if (/image\/(?:x-icon|vnd\.microsoft\.icon)/i.test(contentType)) {
      throw new Error("favicon/ICO is not accepted as station artwork");
    }
    if (!contentType.toLowerCase().startsWith("image/")) {
      throw new Error(`mWyniki flag returned ${contentType || "unknown content-type"}`);
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length) {
      throw new Error("mWyniki flag returned an empty image");
    }

    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, bytes);
    console.log(
      `[instant.audio] Flag saved for ${country.slug} from mWyniki: ${relative}`,
    );

    return relative;
  } catch (error) {
    console.warn(
      `[instant.audio] mWyniki flag lookup failed for ${country.slug}: ${error.message}`,
    );
    return existingFlag;
  }
}

async function backupStationArtwork(country, stationSlug, imagePath) {
  if (!imagePath?.startsWith("/img/")) return "";

  const source = path.join(ROOT, "public", imagePath);
  if (!(await exists(source))) return "";

  const filename = path.basename(imagePath);
  const backup = path.join(
    STATION_ARTWORK_BACKUP_ROOT,
    country.area,
    country.slug,
    filename,
  );

  if (await exists(backup)) return backup;

  await mkdir(path.dirname(backup), { recursive: true });
  await copyFile(source, backup);

  console.log(
    `[instant.audio] Backed up existing artwork for ${country.slug}/${stationSlug}: ${path.relative(ROOT, backup)}`,
  );

  return backup;
}

async function findExistingStationImage(country, stationSlug) {
  const base = path.join(ROOT, "public", "img", country.area, country.slug);
  for (const extension of ["png", "jpg", "webp", "gif", "svg"]) {
    const destination = path.join(base, `${stationSlug}.${extension}`);
    if (await exists(destination)) {
      return `/img/${country.area}/${country.slug}/${stationSlug}.${extension}`;
    }
  }
  return "";
}

export function imageExtension(contentType, imageUrl) {
  const normalized = String(contentType || "").split(";")[0].trim().toLowerCase();
  if (IMAGE_EXTENSIONS.has(normalized)) return IMAGE_EXTENSIONS.get(normalized);

  try {
    const ext = path.extname(new URL(imageUrl).pathname).slice(1).toLowerCase();
    if (["png", "jpg", "jpeg", "webp", "gif", "svg", "avif"].includes(ext)) {
      return ext === "jpeg" ? "jpg" : ext;
    }
  } catch {
    // Ignore malformed image URLs.
  }

  return "";
}


export function stationArtworkConvertArgs(sourcePath, destination) {
  return [
    `${sourcePath}[0]`,
    "-auto-orient",
    "-resize",
    `${STATION_ARTWORK_WIDTH}x${STATION_ARTWORK_HEIGHT}>`,
    "-gravity",
    "center",
    "-background",
    "none",
    "-extent",
    `${STATION_ARTWORK_WIDTH}x${STATION_ARTWORK_HEIGHT}`,
    `PNG32:${destination}`,
  ];
}

function imageMagickCommand() {
  const magick = spawnSync("magick", ["-version"], { stdio: "ignore" });
  if (magick.status === 0) return "magick";

  const convert = spawnSync("convert", ["-version"], { stdio: "ignore" });
  if (convert.status === 0) return "convert";

  return "";
}

async function normalizeStationArtwork(bytes, extension, destination) {
  const command = imageMagickCommand();
  if (!command) {
    throw new Error(
      "ImageMagick is required to normalize station artwork to 96x66",
    );
  }

  await mkdir(path.dirname(destination), { recursive: true });
  const sourcePath = `${destination}.source.${extension || "img"}`;

  try {
    await writeFile(sourcePath, bytes);

    const result = spawnSync(
      command,
      stationArtworkConvertArgs(sourcePath, destination),
      {
        encoding: "utf8",
        maxBuffer: 1024 * 1024,
      },
    );

    if (result.status !== 0) {
      throw new Error(
        String(result.stderr || result.stdout || "ImageMagick conversion failed").trim(),
      );
    }
  } finally {
    await unlink(sourcePath).catch(() => {});
  }
}

export function extractStationImageCandidates(html, pageUrl) {
  const source = String(html || "");
  const candidates = [];

  const add = (value) => {
    const raw = String(value || "").trim();
    if (!raw) return;
    try {
      const absolute = new URL(raw, pageUrl).toString();
      if (!/^https?:\/\//i.test(absolute)) return;
      if (/\.ico(?:[?#].*)?$/i.test(absolute)) return;
      if (!candidates.includes(absolute)) candidates.push(absolute);
    } catch {
      // Ignore malformed image URLs.
    }
  };

  const metaPatterns = [
    /<meta\b[^>]*(?:property|name)=["'](?:og:image|twitter:image|twitter:image:src)["'][^>]*content=["']([^"']+)["'][^>]*>/gi,
    /<meta\b[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:image|twitter:image|twitter:image:src)["'][^>]*>/gi,
  ];

  for (const pattern of metaPatterns) {
    let match;
    while ((match = pattern.exec(source))) add(match[1]);
  }

  return candidates;
}

async function tryDownloadStationImage(country, stationSlug, imageUrl, referer) {
  if (!/^https?:\/\//i.test(String(imageUrl || ""))) return "";
  if (/\.ico(?:[?#].*)?$/i.test(String(imageUrl))) return "";

  try {
    const response = await fetchWithRetry(imageUrl, {
      timeoutMs: 6000,
      headers: {
        accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        referer: referer || country.domain + "/"
      }
    }, 1);

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.toLowerCase().startsWith("image/")) {
      throw new Error(`unexpected content-type ${contentType || "unknown"}`);
    }

    const declaredLength = Number(response.headers.get("content-length") || 0);
    if (declaredLength > MAX_IMAGE_BYTES) {
      throw new Error(`image is too large (${declaredLength} bytes)`);
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) {
      throw new Error(`invalid image size (${bytes.length} bytes)`);
    }

    const extension = imageExtension(contentType, imageUrl);
    if (!extension) {
      throw new Error(`unsupported image type ${contentType || imageUrl}`);
    }

    const relative = `/img/${country.area}/${country.slug}/${stationSlug}.png`;
    if (dryRun) return relative;

    const destination = path.join(ROOT, "public", relative);

    const existingArtwork = await findExistingStationImage(country, stationSlug);
    if (existingArtwork) {
      await backupStationArtwork(country, stationSlug, existingArtwork);
    }

    await normalizeStationArtwork(bytes, extension, destination);
    runStats.imagesDownloaded += 1;
    console.log(
      `[instant.audio] Image normalized to 96x66 PNG for ${country.slug}/${stationSlug}: ${relative}`,
    );
    return relative;
  } catch (error) {
    runStats.imageCandidateFailures += 1;
    console.warn(
      `[instant.audio] Image candidate failed for ${country.slug}/${stationSlug}: ${error.message}`,
    );
    return "";
  }
}

export function classifyStationArtwork(imagePath = "") {
  const image = String(imagePath || "").trim();

  if (!image || image === DEFAULT_STATION_IMAGE) {
    return {
      status: "fallback",
      source: "default-radio",
      reason: image ? "no-usable-source" : "missing-artwork",
      needs_reprocess: true,
    };
  }

  if (image.startsWith("/img/")) {
    return {
      status: "local",
      source: "repository",
      needs_reprocess: false,
    };
  }

  return {
    status: "external",
    source: "legacy-external",
    reason: "not-normalized",
    needs_reprocess: true,
  };
}

function tagStationArtworkMetadata(stations = {}) {
  let tagged = 0;

  for (const station of Object.values(stations)) {
    if (!station || typeof station !== "object") continue;
    if (station.artwork && typeof station.artwork === "object") continue;

    station.artwork = classifyStationArtwork(station.features);
    tagged += 1;
  }

  return tagged;
}

async function resolveStationImage(country, stationSlug, preferredImage, homepageUrl) {
  const existing = await findExistingStationImage(country, stationSlug);
  if (existing) {
    runStats.imagesExisting += 1;
    return existing;
  }

  const homepage =
    /^https?:\/\//i.test(String(homepageUrl || ""))
      ? String(homepageUrl)
      : "";

  const preferred = await tryDownloadStationImage(
    country,
    stationSlug,
    preferredImage,
    homepage || country.domain + "/",
  );
  if (preferred) return preferred;

  const candidates = [];
  if (homepage) {
    try {
      const page = await fetchWithRetry(homepage, {
        timeoutMs: 6000,
        headers: {
          accept: "text/html,application/xhtml+xml",
          referer: country.domain + "/"
        }
      }, 1);
      const html = await page.text();
      candidates.push(...extractStationImageCandidates(html, homepage));
    } catch (error) {
      runStats.homepageArtworkFailures += 1;
      console.warn(
        `[instant.audio] Unable to inspect homepage artwork for ${country.slug}/${stationSlug}: ${error.message}`,
      );
    }
  }

  for (const candidate of candidates) {
    const local = await tryDownloadStationImage(
      country,
      stationSlug,
      candidate,
      homepage,
    );
    if (local) return local;
  }

  runStats.imagesFallback += 1;
  console.warn(
    `[instant.audio] Using default radio artwork for ${country.slug}/${stationSlug}`,
  );
  return DEFAULT_STATION_IMAGE;
}

function stationFromInstantPayload(country, candidate, apiUrl, payload) {
  const instantResult = payload?.result || payload || {};
  const stationMetadata = instantResult.station || {};
  const streamCandidates = findInstantAudioStreams(payload);
  const streamInfo = streamCandidates[0];

  if (!streamInfo) return null;

  const title =
    String(stationMetadata.title || "").trim() ||
    findTextField(payload, ["station_name", "title", "name"]) ||
    candidate.title
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^./, (char) => char.toUpperCase());

  const description = findTextField(payload, [
    "description",
    "summary",
    "profile"
  ]);
  const image =
    findTextField(payload, [
      "logo",
      "image",
      "image_url",
      "station_image",
      "artwork"
    ]) || candidate.imageUrl || "";
  const website =
    typeof stationMetadata.url === "string" &&
    /^https?:\/\//i.test(stationMetadata.url)
      ? stationMetadata.url
      : candidate.pageUrl;

  return {
    title,
    ...(description ? { description } : {}),
    ...(stationMetadata.signal ? { signal: stationMetadata.signal } : {}),
    ...(typeof stationMetadata.acrCloud === "boolean"
      ? { acrCloud: stationMetadata.acrCloud }
      : {}),
    type: streamInfo.type || detectMime(streamInfo.url),
    url: website,
    cros: streamInfo.cros,
    stream: streamInfo.url,
    streams: streamCandidates,
    features:
      image && /^https?:\/\//i.test(image)
        ? image
        : DEFAULT_STATION_IMAGE,
    source: apiUrl
  };
}

async function syncStation(country, countryId, candidate) {
  const apiUrl = API_BASE + "/" + countryId + "/" + candidate.slug;

  try {
    const response = await fetchWithRetry(apiUrl, {
      headers: {
        accept: "application/json, text/plain, */*",
        referer: country.domain + "/"
      }
    });
    const payload = await response.json();
    const station = stationFromInstantPayload(country, candidate, apiUrl, payload);
    if (station) {
      station.features = await resolveStationImage(
        country,
        candidate.slug,
        station.features,
        station.url,
      );
      station.artwork = classifyStationArtwork(station.features);
    }
    return {
      station,
      status: response.status,
      via: "direct"
    };
  } catch (error) {
    if (error?.status !== 404) {
      console.warn(
        "Skip " + country.slug + "/" + candidate.slug + ": " + error.message,
      );
    }
    return {
      station: null,
      status: Number(error?.status || 0),
      via: "direct",
      error: String(error?.message || error)
    };
  }
}

async function probeCountryId(country, candidate) {
  const MAX_ID = 180;
  const BATCH_SIZE = 8;

  console.warn(
    `[instant.audio] Country preload ID unavailable; probing API IDs for ${candidate.slug}`,
  );

  for (let start = 1; start <= MAX_ID; start += BATCH_SIZE) {
    const ids = Array.from(
      { length: Math.min(BATCH_SIZE, MAX_ID - start + 1) },
      (_, index) => start + index,
    );

    const results = await Promise.all(
      ids.map(async (id) => {
        const url = `${API_BASE}/${id}/${candidate.slug}`;
        try {
          const response = await fetch(url, {
            redirect: "follow",
            headers: {
              accept: "application/json, text/plain, */*",
              referer: `${country.domain}/`,
              "user-agent": USER_AGENT
            }
          });
          if (!response.ok) return null;

          const payload = await response.json();
          return findInstantAudioStream(payload) ? String(id) : null;
        } catch {
          return null;
        }
      }),
    );

    const found = results.find(Boolean);
    if (found) return found;

    await sleep(150);
  }

  return "";
}

function radioBrowserMime(codec, streamUrl) {
  const value = String(codec || "").toLowerCase();
  if (value.includes("aac")) return "audio/aac";
  if (value.includes("ogg")) return "audio/ogg";
  if (value.includes("opus")) return "audio/opus";
  return detectMime(streamUrl);
}

async function syncFromRadioBrowser(country, metadata) {
  const countryCode = String(metadata.cca2 || country.cca2 || "").trim();
  const countryName = String(metadata.commonName || country.label || country.slug).trim();
  const limit = maxStations > 0 ? maxStations : 100;

  let endpoint;
  if (countryCode) {
    endpoint =
      `${RADIO_BROWSER_BASE}/${encodeURIComponent(countryCode)}` +
      `?hidebroken=true&order=votes&reverse=true&limit=${limit}`;
  } else {
    const base = RADIO_BROWSER_BASE.replace("/bycountrycodeexact", "");
    endpoint =
      `${base}/bycountryexact/${encodeURIComponent(countryName)}` +
      `?hidebroken=true&order=votes&reverse=true&limit=${limit}`;
    console.warn(
      `[instant.audio] Missing country code for ${country.slug}; falling back to Radio Browser country-name lookup (${countryName})`,
    );
  }

  console.warn(
    `[instant.audio] Falling back to Radio Browser for ${country.slug}`,
  );

  const response = await fetchWithRetry(endpoint, {
    headers: {
      accept: "application/json",
      "user-agent": USER_AGENT
    }
  });
  const payload = await response.json();
  const stations = {};

  const items = Array.isArray(payload) ? payload : [];
  const prepared = [];

  for (const item of items) {
    const title = String(item.name || "").trim();
    const stream = String(item.url_resolved || item.url || "").trim();

    if (!title || !/^https?:\/\//i.test(stream)) continue;

    let slug = slugify(title);
    if (!slug) continue;

    if (prepared.some((entry) => entry.slug === slug)) {
      slug = `${slug}-${String(item.stationuuid || "").slice(0, 8)}`;
    }

    const tags = String(item.tags || "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 5);

    const streamCandidates = normalizeStationStreams({
      stream,
      type: radioBrowserMime(item.codec, stream),
      cros: stream.startsWith("http://"),
      source: `radio-browser:${item.stationuuid || slug}`,
      streams: [
        {
          url: String(item.url_resolved || "").trim(),
          type: radioBrowserMime(item.codec, String(item.url_resolved || "")),
          source: "radio-browser:resolved",
        },
        {
          url: String(item.url || "").trim(),
          type: radioBrowserMime(item.codec, String(item.url || "")),
          source: "radio-browser:raw",
        },
      ],
    });

    prepared.push({ item, title, stream, streamCandidates, slug, tags });
  }

  const ARTWORK_CONCURRENCY = 6;
  for (let index = 0; index < prepared.length; index += ARTWORK_CONCURRENCY) {
    const batch = prepared.slice(index, index + ARTWORK_CONCURRENCY);

    const resolved = await Promise.all(
      batch.map(async ({ item, title, stream, streamCandidates, slug, tags }) => {
        const features = await resolveStationImage(
          country,
          slug,
          String(item.favicon || ""),
          String(item.homepage || ""),
        );

        return {
          slug,
          station: {
            title,
            ...(tags.length ? { description: tags.join(", ") } : {}),
            type: radioBrowserMime(item.codec, stream),
            url: String(item.homepage || country.domain),
            cros: stream.startsWith("http://"),
            stream,
            streams: streamCandidates,
            features,
            artwork: classifyStationArtwork(features),
            source: `radio-browser:${item.stationuuid || slug}`,
          },
        };
      }),
    );

    for (const { slug, station } of resolved) {
      stations[slug] = station;
    }

    console.log(
      `[instant.audio] ${country.slug} artwork progress: ${Math.min(index + ARTWORK_CONCURRENCY, prepared.length)}/${prepared.length}`,
    );
  }

  const keys = Object.keys(stations);
  if (!keys.length) {
    throw new Error(
      `Radio Browser returned no playable stations for ${country.slug}`,
    );
  }

  stations[keys[0]].favorite = true;
  return stations;
}
async function syncCountry(country, metadata) {
  console.log(
    "\n[instant.audio] Syncing " +
      country.area +
      "/" +
      country.slug +
      " from " +
      country.domain,
  );

  const countrySource = await fetchTextSource(country.domain + "/");
  const html = countrySource.text;
  const pageConfig = extractWebradioConfig(html);

  if (!metadata.cca2 && pageConfig.countryCode) {
    metadata.cca2 = pageConfig.countryCode;
  }

  let candidates = extractStationCandidates(html, country.domain);
  let countryId =
    pageConfig.domainID ||
    extractCountryId(countrySource.response, html);

  if (!candidates.length) {
    throw new Error("Unable to discover station slugs for " + country.domain);
  }

  if (!countryId) {
    countryId = await probeCountryId(country, candidates[0]);
  }

  if (!countryId) {
    throw new Error(
      "Unable to discover InstantAudio country ID for " + country.domain,
    );
  }
  if (maxStations > 0) candidates = candidates.slice(0, maxStations);

  console.log(
    "[instant.audio] Country ID " +
      countryId +
      "; validating " +
      candidates.length +
      " candidate station(s)",
  );

  const stations = {};
  let consecutiveForbidden = 0;

  if (!directApiBlockedForRun) {
    for (const candidate of candidates) {
      const result = await syncStation(country, countryId, candidate);

      if (result.station) {
        stations[candidate.slug] = result.station;
        consecutiveForbidden = 0;
        console.log("  + " + candidate.slug);
      } else if (result.status === 403) {
        consecutiveForbidden += 1;
        if (consecutiveForbidden >= 3) {
          directApiBlockedForRun = true;
          console.warn(
            "[instant.audio] Direct API is blocked on this runner; remaining countries will use Radio Browser directly",
          );
          break;
        }
      } else {
        consecutiveForbidden = 0;
      }

      await sleep(120);
    }
  } else {
    console.log(
      "[instant.audio] Direct API already marked blocked for this run; skipping InstantAudio stream requests",
    );
  }

  const keys = Object.keys(stations);
  if (!keys.length) {
    const fallbackStations = await syncFromRadioBrowser(country, metadata);
    return {
      stations: fallbackStations,
      countryId,
      source: directApiBlockedForRun
        ? "radio-browser-after-api-block"
        : "radio-browser-fallback"
    };
  }

  stations[keys[0]].favorite = true;

  return {
    stations,
    countryId,
    source:
      keys.length < candidates.length
        ? "instant-audio-partial"
        : "instant-audio"
  };
}

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

async function writeJson(file, data) {
  if (dryRun) return;
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`);
}

export function normalizeStreamIdentity(value = "") {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return String(value).trim().replace(/\/$/, "").toLowerCase();
  }
}

export function mergeStations(existing, discovered) {
  const merged = Object.fromEntries(
    Object.entries(existing).map(([slug, station]) => [
      slug,
      {
        ...station,
        streams: normalizeStationStreams(station),
      },
    ]),
  );

  const streamOwner = new Map();
  for (const [slug, station] of Object.entries(merged)) {
    for (const candidate of normalizeStationStreams(station)) {
      streamOwner.set(normalizeStreamIdentity(candidate.url), slug);
    }
  }

  const existingHasFavorite = Object.values(existing).some(
    (station) => station?.favorite === true,
  );

  let added = 0;
  let enriched = 0;

  for (const [baseSlug, stationValue] of Object.entries(discovered)) {
    const discoveredStreams = normalizeStationStreams(stationValue);
    if (!discoveredStreams.length) continue;

    const matchedByStream = discoveredStreams
      .map((candidate) => streamOwner.get(normalizeStreamIdentity(candidate.url)))
      .find(Boolean);
    const targetSlug = merged[baseSlug] ? baseSlug : matchedByStream;

    if (targetSlug) {
      const current = merged[targetSlug];
      const before = normalizeStationStreams(current);
      const combined = normalizeStationStreams({
        ...current,
        streams: [...before, ...discoveredStreams],
      });

      if (combined.length > before.length) enriched += 1;

      merged[targetSlug] = {
        ...current,
        ...(current.description ? {} : stationValue.description ? { description: stationValue.description } : {}),
        ...(current.features ? {} : stationValue.features ? { features: stationValue.features } : {}),
        streams: combined,
        stream: combined[0].url,
        type: combined[0].type,
        cros: combined[0].cros,
      };

      for (const candidate of combined) {
        streamOwner.set(normalizeStreamIdentity(candidate.url), targetSlug);
      }
      continue;
    }

    let slug = baseSlug;
    let suffix = 2;
    while (merged[slug]) {
      slug = `${baseSlug}-instant-audio${suffix === 2 ? "" : `-${suffix}`}`;
      suffix += 1;
    }

    const station = {
      ...stationValue,
      streams: discoveredStreams,
      stream: discoveredStreams[0].url,
      type: discoveredStreams[0].type,
      cros: discoveredStreams[0].cros,
    };
    if (existingHasFavorite || added > 0) delete station.favorite;

    merged[slug] = station;
    for (const candidate of discoveredStreams) {
      streamOwner.set(normalizeStreamIdentity(candidate.url), slug);
    }
    added += 1;
  }

  return { stations: merged, added, enriched };
}

async function repairStationImages(country, stations) {
  tagStationArtworkMetadata(stations);

  for (const [slug, station] of Object.entries(stations)) {
    const image = String(station?.features || "");
    if (!image.startsWith("/img/")) {
      station.artwork = classifyStationArtwork(image);
      continue;
    }

    const imageFile = path.join(ROOT, "public", image);
    const missing = !(await exists(imageFile));
    const lowQuality = /\.ico$/i.test(image);

    if (!missing && !lowQuality) {
      station.artwork = classifyStationArtwork(image);
      continue;
    }

    console.warn(
      `[instant.audio] Repairing ${lowQuality ? "low-quality" : "missing"} artwork for ${country.slug}/${slug}: ${image}`,
    );

    station.features = await resolveStationImage(
      country,
      slug,
      "",
      station?.url || country.domain,
    );
    station.artwork = classifyStationArtwork(station.features);
  }

  return stations;
}

export function resolveCountryTimezone(existing = {}, metadata = {}) {
  return existing.timezone || metadata.timezone || "UTC";
}

async function updateWorldFlag(country, flagPath) {
  if (!flagPath) return;

  const file = path.join(ROOT, "public", "radio", "world.json");
  const world = await readJson(file);
  const areaKey = country.area.replace(/-/g, "_");
  const existing = world?.[areaKey]?.[country.slug];

  if (!existing) {
    console.warn(
      `[instant.audio] Skipping world flag update for unknown country ${country.area}/${country.slug}`,
    );
    return;
  }

  if (existing.flag === flagPath) return;

  world[areaKey][country.slug] = {
    ...existing,
    flag: flagPath,
  };
  await writeJson(file, world);

  const tsFile = path.join(ROOT, "data", "world.ts");
  const ts = `// Auto-generated from public/radio/world.json to avoid Vite JSON transform issues in CI\nconst world = ${JSON.stringify(world, null, 2)} as const;\n\nexport default world;\n`;
  await writeFile(tsFile, ts);
}

async function syncFlagsOnly(targets) {
  let success = 0;
  let failed = 0;

  console.log(
    "[instant.audio] Flags-only mode: " +
      targets.map((item) => item.area + "/" + item.slug).join(", "),
  );

  for (const country of targets) {
    try {
      const metadata = await getCountryMetadata(country);
      const flagPath = await downloadFlag(country, metadata);

      if (!flagPath) {
        failed += 1;
        console.warn(`[instant.audio] No flag available for ${country.slug}`);
        continue;
      }

      await updateWorldFlag(country, flagPath);
      success += 1;
      console.log(`[instant.audio] Flag ready for ${country.slug}: ${flagPath}`);
    } catch (error) {
      failed += 1;
      console.error(
        `[instant.audio] Flag sync failed for ${country.slug}: ${error.message}`,
      );
    }
  }

  console.log(
    `[instant.audio] Flags-only summary: success ${success}, failed ${failed}`,
  );

  if (failed > 0) process.exitCode = 1;
}
async function updateWorld(country, metadata, stationCount, flagPath) {
  const file = path.join(ROOT, "public", "radio", "world.json");
  const world = await readJson(file);
  const areaKey = country.area.replace(/-/g, "_");
  world[areaKey] ||= {};
  const existing = world[areaKey][country.slug] || {};
  world[areaKey][country.slug] = {
    ...existing,
    name: `world.${areaKey}.${country.slug.replace(/-/g, "_")}`,
    flag:
      flagPath ||
      existing.flag ||
      `/img/${country.area}/flags/${country.slug}.png`,
    data: `/assets/radio/${country.area}/${country.slug}.json`,
    timezone: resolveCountryTimezone(existing, metadata),
    station: stationCount
  };

  await writeJson(file, world);

  if (!dryRun) {
    const tsFile = path.join(ROOT, "data", "world.ts");
    const ts = `// Auto-generated from public/radio/world.json to avoid Vite JSON transform issues in CI\nconst world = ${JSON.stringify(world, null, 2)} as const;\n\nexport default world;\n`;
    await writeFile(tsFile, ts);
  }
}

async function updateLocales(country, metadata) {
  if (!metadata.cca2) return;
  const areaKey = country.area.replace(/-/g, "_");
  const countryKey = country.slug.replace(/-/g, "_");

  for (const [fileName, locale] of Object.entries(LOCALES)) {
    const file = path.join(ROOT, "lang", fileName);
    const data = await readJson(file);
    data.world ||= {};
    data.world[areaKey] ||= {};

    let localizedName = metadata.commonName || country.label;
    try {
      localizedName =
        new Intl.DisplayNames([locale], { type: "region" }).of(metadata.cca2) ||
        localizedName;
    } catch {
      // Use the canonical country name as a safe fallback.
    }

    data.world[areaKey][countryKey] = localizedName;
    await writeJson(file, data);
  }
}

async function persistCountryRegistry(discovered) {
  if (dryRun || !discovered.length) return;
  const registryFile = path.join(ROOT, "data", "instant-audio-countries.json");
  let existing = [];
  try {
    existing = await readJson(registryFile);
  } catch {
    // Allow the registry to be recreated from live discovery.
  }
  const existingByKey = new Map(
    (Array.isArray(existing) ? existing : []).map((item) => [item.area + "/" + item.slug, item]),
  );
  const merged = discovered.map((item) => ({
    ...(existingByKey.get(item.area + "/" + item.slug) || {}),
    ...item,
  }));
  await writeJson(registryFile, merged);
}

function rotateExistingCountries(countries, count) {
  if (!countries.length) return [];
  const runNumber = Number(process.env.GITHUB_RUN_NUMBER || 0);
  const offset = runNumber > 0 ? runNumber % countries.length : 0;
  const rotated = [...countries.slice(offset), ...countries.slice(0, offset)];
  return rotated.slice(0, count);
}
async function loadCountryDirectory() {
  try {
    const source = await fetchTextSource(INSTANT_HOME);
    const discovered = discoverCountries(source.text);

    if (discovered.length) {
      console.log("[instant.audio] Discovered " + discovered.length + " countries from instant.audio");
      await persistCountryRegistry(discovered);
      return discovered;
    }

    console.warn("[instant.audio] instant.audio directory is blocked or unreadable; using repository snapshot");
  } catch (error) {
    console.warn("[instant.audio] Unable to refresh instant.audio directory directly; using repository snapshot: " + error.message);
  }

  console.warn("[instant.audio] Using repository country snapshot");
  const registryFile = path.join(ROOT, "data", "instant-audio-countries.json");
  const registry = await readJson(registryFile);

  if (!Array.isArray(registry) || !registry.length) {
    throw new Error("InstantAudio country registry is empty");
  }

  console.log("[instant.audio] Loaded " + registry.length + " countries from repository snapshot");
  return registry;
}
function imageStatsSnapshot() {
  return {
    downloaded: runStats.imagesDownloaded,
    existing: runStats.imagesExisting,
    fallback: runStats.imagesFallback,
    candidateFailures: runStats.imageCandidateFailures,
    homepageFailures: runStats.homepageArtworkFailures,
  };
}

function imageStatsDelta(before) {
  return {
    downloaded: runStats.imagesDownloaded - before.downloaded,
    existing: runStats.imagesExisting - before.existing,
    fallback: runStats.imagesFallback - before.fallback,
    candidateFailures: runStats.imageCandidateFailures - before.candidateFailures,
    homepageFailures: runStats.homepageArtworkFailures - before.homepageFailures,
  };
}

async function writeRunSummary() {
  const lines = [
    "",
    "========== RADIO SYNC SUMMARY ==========",
    `Countries: success ${runStats.countriesSucceeded}, failed ${runStats.countriesFailed}`,
    `Stations: discovered ${runStats.stationsDiscovered}, added ${runStats.stationsAdded}`,
    `Artwork: downloaded ${runStats.imagesDownloaded}, reused local ${runStats.imagesExisting}, fallback ${runStats.imagesFallback}, needs reprocess ${runStats.artworkNeedsReprocess}`,
    `Artwork attempts: candidate failures ${runStats.imageCandidateFailures}, homepage inspect failures ${runStats.homepageArtworkFailures}`,
    `InstantAudio direct API blocked: ${directApiBlockedForRun ? "yes" : "no"}`,
    "========================================",
  ];

  console.log(lines.join("\n"));

  if (runStats.countries.length) {
    console.log("\nCountry breakdown:");
    console.table(
      runStats.countries.map((item) => ({
        Country: item.country,
        Status: item.status,
        Source: item.source || "-",
        Discovered: item.discovered,
        Added: item.added,
        Total: item.total,
        Downloaded: item.downloaded,
        Reused: item.reused,
        Fallback: item.fallback,
        "Needs reprocess": item.needsReprocess,
        "Candidate fail": item.candidateFailures,
        "Homepage fail": item.homepageFailures,
      })),
    );
  }

  if (process.env.GITHUB_STEP_SUMMARY) {
    const markdown = [
      "## Radio sync result",
      "",
      "### Countries",
      "",
      "| Metric | Count |",
      "| --- | ---: |",
      `| Succeeded | ${runStats.countriesSucceeded} |`,
      `| Failed | ${runStats.countriesFailed} |`,
      "",
      "### Country breakdown",
      "",
      "| Country | Status | Source | Discovered | Added | Total | Artwork downloaded | Reused | Fallback | Needs reprocess | Candidate failures | Homepage failures |",
      "| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
      ...runStats.countries.map((item) =>
        `| ${item.country} | ${item.status} | ${item.source || "-"} | ${item.discovered} | ${item.added} | ${item.total} | ${item.downloaded} | ${item.reused} | ${item.fallback} | ${item.needsReprocess} | ${item.candidateFailures} | ${item.homepageFailures} |`
      ),
      "",
      "### Stations",
      "",
      "| Metric | Count |",
      "| --- | ---: |",
      `| Discovered | ${runStats.stationsDiscovered} |`,
      `| Added | ${runStats.stationsAdded} |`,
      "",
      "### Artwork",
      "",
      "| Metric | Count |",
      "| --- | ---: |",
      `| Downloaded | ${runStats.imagesDownloaded} |`,
      `| Reused local | ${runStats.imagesExisting} |`,
      `| Fallback | ${runStats.imagesFallback} |`,
      `| Needs reprocess | ${runStats.artworkNeedsReprocess} |`,
      `| Failed candidates | ${runStats.imageCandidateFailures} |`,
      `| Homepage inspection failures | ${runStats.homepageArtworkFailures} |`,
      "",
      "### Upstream",
      "",
      "| Check | Result |",
      "| --- | --- |",
      `| InstantAudio direct API blocked | ${directApiBlockedForRun ? "Yes" : "No"} |`,
      "",
    ].join("\n");

    await appendFile(process.env.GITHUB_STEP_SUMMARY, markdown);
  }
}

async function main() {
  const discovered = await loadCountryDirectory();
  const missing = [];
  const existing = [];

  for (const country of discovered) {
    if (requestedCountry && country.slug !== requestedCountry) continue;

    const destination = path.join(ROOT, "public", "radio", country.area, country.slug + ".json");
    const isMissing = !(await exists(destination));
    const item = { ...country, destination, isMissing };

    if (requestedCountry) {
      missing.push(item);
      continue;
    }

    if (isMissing) missing.push(item);
    else existing.push(item);
  }

  if (flagsOnly) {
    const flagTargets = [];

    for (const country of discovered) {
      if (requestedCountry && country.slug !== requestedCountry) continue;

      const pngPath = path.join(
        ROOT,
        "public",
        "img",
        country.area,
        "flags",
        `${country.slug}.png`,
      );

      const missingPng = !(await exists(pngPath));
      if (requestedCountry || refreshExisting || missingPng) {
        flagTargets.push({
          ...country,
          isMissing: missingPng,
        });
      }
    }

    const targets = requestedCountry
      ? flagTargets.slice(0, 1)
      : refreshExisting
        ? rotateExistingCountries(flagTargets, maxCountries)
        : flagTargets.slice(0, maxCountries);

    if (!targets.length) {
      console.log("[instant.audio] No missing country PNG flags found.");
      return;
    }

    console.log(
      "[instant.audio] Flag target(s): " +
        targets.map((item) =>
          item.area + "/" + item.slug + (item.isMissing ? " (missing PNG)" : " (refresh)")
        ).join(", "),
    );

    await syncFlagsOnly(targets);
    return;
  }

  let targets;
  if (requestedCountry) {
    targets = missing.slice(0, 1);
  } else if (refreshExisting) {
    targets = rotateExistingCountries(existing, maxCountries);
    console.log("[instant.audio] Existing-country refresh requested; selected " + targets.length + " rotating target(s)");
  } else if (missing.length) {
    targets = missing.slice(0, maxCountries);
  } else {
    targets = rotateExistingCountries(existing, maxCountries);
    console.log("[instant.audio] No missing countries found; rotating through " + targets.length + " existing country/countries for station augmentation");
  }

  if (!targets.length) {
    console.log("[instant.audio] No eligible countries found for this run.");
    return;
  }

  console.log(
    "[instant.audio] Target(s): " + targets.map((item) =>
      item.area + "/" + item.slug + (item.isMissing ? " (missing)" : " (augment)")
    ).join(", "),
  );

  let failedCountries = 0;
  for (const country of targets) {
    const imageBefore = imageStatsSnapshot();
    try {
        const metadata = await getCountryMetadata(country);
        const { stations: discoveredStations, countryId, source } = await syncCountry(country, metadata);
        const flagPath = await downloadFlag(country, metadata);
    
        let stations = discoveredStations;
        let added = Object.keys(discoveredStations).length;
    
        if (!country.isMissing) {
          const existingStations = await readJson(country.destination);
          const merged = mergeStations(existingStations, discoveredStations);
          stations = merged.stations;
          added = merged.added;
          if (merged.enriched > 0) {
            console.log(
              `[instant.audio] ${country.slug}: enriched ${merged.enriched} existing station(s) with fallback stream(s)`,
            );
          }
        }
    
        const artworkMetadataAdded = tagStationArtworkMetadata(stations);
        stations = await repairStationImages(country, stations);

        const needsReprocess = Object.values(stations).filter(
          (station) => station?.artwork?.needs_reprocess === true,
        ).length;
        runStats.artworkNeedsReprocess += needsReprocess;

        const discoveredCount = Object.keys(discoveredStations).length;
        runStats.countriesSucceeded += 1;
        runStats.stationsDiscovered += discoveredCount;
        runStats.stationsAdded += added;

        const imageDelta = imageStatsDelta(imageBefore);

        runStats.countries.push({
          country: country.slug,
          source,
          discovered: discoveredCount,
          added,
          total: Object.keys(stations).length,
          downloaded: imageDelta.downloaded,
          reused: imageDelta.existing,
          fallback: imageDelta.fallback,
          needsReprocess,
          candidateFailures: imageDelta.candidateFailures,
          homepageFailures: imageDelta.homepageFailures,
          status: "success",
        });

        console.log(
          "[instant.audio] " + country.slug + ": discovered " + discoveredCount +
          ", added " + added + ", total " + Object.keys(stations).length +
          "; API country ID " + countryId + ", source " + source,
        );
        console.log(
          "[instant.audio] " + country.slug + " artwork: downloaded " + imageDelta.downloaded +
          ", reused " + imageDelta.existing +
          ", fallback " + imageDelta.fallback +
          ", failed candidates " + imageDelta.candidateFailures +
          ", homepage failures " + imageDelta.homepageFailures,
        );
    
        if (!dryRun) {
          const artworkChanged =
            artworkMetadataAdded > 0 ||
            imageDelta.downloaded > 0 ||
            imageDelta.fallback > 0;

          if (country.isMissing || added > 0 || artworkChanged) {
            await writeJson(country.destination, stations);
          }
          await updateWorld(country, metadata, Object.keys(stations).length, flagPath);
          await updateLocales(country, metadata);
        }
      } catch (error) {
      failedCountries += 1;
      runStats.countriesFailed += 1;
      const imageDelta = imageStatsDelta(imageBefore);
      runStats.countries.push({
        country: country.slug,
        source: "",
        discovered: 0,
        added: 0,
        total: 0,
        downloaded: imageDelta.downloaded,
        reused: imageDelta.existing,
        fallback: imageDelta.fallback,
        needsReprocess: 0,
        candidateFailures: imageDelta.candidateFailures,
        homepageFailures: imageDelta.homepageFailures,
        status: "failed",
      });
      console.error(
        `[instant.audio] ${country.slug}: sync failed, skipping country: ${error.message}`,
      );
    }
  }

  if (failedCountries === targets.length) {
    console.warn(
      "[instant.audio] All selected countries failed; run completed without data changes.",
    );
  }
  if (dryRun) {
    console.log("[instant.audio] Dry run complete; repository files were not changed.");
  }

  await writeRunSummary();
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error("[instant.audio] Sync failed:", error);
    process.exitCode = 1;
  });
}
