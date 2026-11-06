// One-time, non-destructive VOH station discovery. Run on GitHub Actions, not in the client.
// VOH pages use Next.js __NEXT_DATA__ and may change without notice.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const CATALOG = resolve(ROOT, "public/radio/asia/viet-nam.json");
const PREFIX = "https://voh.com.vn";

export const missingVohStations = [
  ["voh-m-fm-92-92-5", "VOH-M FM 92–92.5 MHz", "kenh-fm-925-02251113001000925.html", "VOH", "https://image.voh.com.vn/voh/image/2025/11/17/92-5-3-104929.png"],
  ["long-an-fm-96-9", "Long An LA34 – FM 96.9 MHz", "kenh-long-an-la34-fm-969.mhz-02231206000000034.html", "Đài địa phương"],
  ["dak-nong-ptd", "Đắk Nông PTD", "kenh-dak-nong-ptd-02231206000000017.html", "Đài địa phương"],
  ["tra-vinh-fm-92-7", "Trà Vinh THTV – FM 92.7 MHz", "kenh-tra-vinh-thtv-fm-927-mhz-02231206000000031.html", "Đài địa phương"],
  ["kon-tum-fm-95-1", "Kon Tum KRT – FM 95.1 MHz", "kenh-kon-tum-krt-fm-951-mhz-02231206000000032.html", "Đài địa phương"],
  ["nghe-an-fm-99-6", "Nghệ An NTV – FM 99.6 MHz", "kenh-nghe-an-ntv-fm-996-mhz-02231206000000027.html", "Đài địa phương"],
  ["bac-lieu-fm-93-8", "Bạc Liêu BTV – FM 93.8 MHz", "kenh-bac-lieu-btv-fm-938-mhz-02231206000000015.html", "Đài địa phương"],
  ["quang-ngai-fm-102-9", "Quảng Ngãi PTQ – FM 102.9 MHz", "kenh-quang-ngai-ptq-fm-1029-mhz-02231206000000040.html", "Đài địa phương"],
];

export function parseNextRadio(html) {
  const found = String(html).match(/<script\b[^>]*\bid=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!found) return { info: {}, urls: [], reason: "no-next-data" };
  const data = JSON.parse(found[1]).props?.pageProps?.pageData || {};
  const info = data.radioLive || data.chanelActive || data.channelActive || data.chanel || {};
  const urls = new Set();
  function walk(value, key = "", depth = 0) {
    if (depth > 12 || !value) return;
    if (typeof value === "string") {
      const candidate = value.replaceAll("\\/", "/").replaceAll("\\u0026", "&");
      if (/^https:\/\//i.test(candidate) && /\.m3u8(?:[?#]|$)/i.test(candidate)
        && /^(url|stream|streamUrl|audioUrl|playUrl|source|liveUrl)$/i.test(key)) {
        urls.add(candidate);
      }
      return;
    }
    if (typeof value !== "object") return;
    if (Array.isArray(value)) {
      // Avoid collecting streams for unrelated carousel/list stations.
      return;
    }
    for (const [subKey, nested] of Object.entries(value)) walk(nested, subKey, depth + 1);
  }
  // Prefer stream sources belonging to the active channel.
  for (const obj of [data.radioLive, data.radioStation, data.radioDetail, data.currentRadio, data.chanelActive]) {
    walk(obj);
  }
  // Some older VOH pages use another shape: accept only ONE distinct stream.
  if (urls.size === 0) walk(data);
  return { info, urls: [...urls], reason: urls.size === 0 ? "no-stream" : "" };
}

async function request(url, ms = 15000, headers = {}) {
  const response = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; ePlusOnAirStationAudit/1.0)", ...headers },
    redirect: "follow", signal: AbortSignal.timeout(ms),
  });
  if (!response.ok) throw new Error("HTTP " + response.status);
  return response;
}

export async function verifyHls(url) {
  if (!/^https:\/\/[^/]+\/.+\.m3u8(?:[?#]|$)/i.test(url)) return false;
  try {
    const response = await request(url, 12000, { accept: "application/vnd.apple.mpegurl,application/x-mpegURL,*/*" });
    if (Number(response.headers.get("content-length")) > 1048576) {
      await response.body?.cancel();
      return false;
    }
    const body = await response.text();
    return body.slice(0, 2048).includes("#EXTM3U");
  } catch (error) {
    console.warn("[VOH] Manifest check failed:", error.message);
    return false;
  }
}

async function saveArtwork(slug, url) {
  if (!/^https:\/\/(?:image|image1)\.voh\.com\.vn\//i.test(url || "")) return "";
  const file = "/img/asia/viet-nam/" + slug + ".png";
  try {
    const response = await request(url, 12000, { accept: "image/png,image/jpeg,image/webp" });
    const ct = (response.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("image/png")) return ""; // Preserve extension and avoid incompatible images.
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 64 || bytes.length > 2097152) return "";
    const dest = resolve(ROOT, "public" + file);
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, bytes);
    return file;
  } catch (error) {
    console.warn("[VOH] Artwork download failed:", slug, error.message);
    return "";
  }
}

export function selectNewEntries(catalog, candidates) {
  const known = new Set(Object.values(catalog).flatMap((item) =>
    [item.stream, item.stream_alternative, ...(item.streams || []).map((s) => s.url)]
      .filter(Boolean).map((url) => url.trim().toLowerCase())
  ));
  const added = [];
  for (const candidate of candidates) {
    if (catalog[candidate.slug] || !candidate.verified) continue;
    const normalized = candidate.stream.trim().toLowerCase();
    if (known.has(normalized)) {
      console.log("[VOH] Duplicate audio source skipped:", candidate.slug);
      continue;
    }
    known.add(normalized);
    const station = {
      title: candidate.title,
      description: "Phát thanh trực tuyến " + candidate.title + ".",
      category: candidate.category,
      type: "application/x-mpegURL",
      url: candidate.page,
      cros: false,
      stream: candidate.stream,
      ...(candidate.features ? { features: candidate.features } : {}),
    };
    catalog[candidate.slug] = station;
    added.push(candidate.slug);
  }
  return added;
}

async function main() {
  const write = process.argv.includes("--write");
  const catalog = JSON.parse(await readFile(CATALOG, "utf8"));
  const before = Object.keys(catalog).length;
  const found = [];

  for (const [slug, title, filename, category, artwork] of missingVohStations) {
    if (catalog[slug]) { console.log("[VOH] Already exists:", slug); continue; }
    const page = PREFIX + "/radio/" + filename;
    try {
      const response = await request(page);
      const parsed = parseNextRadio(await response.text());
      const stream = parsed.urls.length === 1 ? parsed.urls[0] : "";
      if (!stream) {
        console.log("[VOH] Skipped:", slug, parsed.reason || "ambiguous-sources", "candidates=" + parsed.urls.length);
        continue;
      }
      const verified = await verifyHls(stream);
      console.log("[VOH] Audited:", slug, "verified=" + verified, "source-host=" + new URL(stream).hostname);
      if (!verified) continue;
      found.push({ slug, title, category, page, stream, verified, artwork: parsed.info.logoPath || artwork || "" });
    } catch (error) {
      console.warn("[VOH] Unable to import", slug, error.message);
    }
  }

  const entries = selectNewEntries(catalog, found);
  console.log("[VOH] Eligible:", entries.join(", ") || "none");
  console.log("[VOH] Previous:", before, "New:", entries.length, "Total:", Object.keys(catalog).length);
  if (!write || !entries.length) return;
  for (const item of found.filter((x) => entries.includes(x.slug))) {
    const features = await saveArtwork(item.slug, item.artwork);
    if (features) catalog[item.slug].features = features;
  }
  await writeFile(CATALOG, JSON.stringify(catalog, null, 2) + "\n");
  console.log("[VOH] Catalog updated. Live playback/CORS needs browser validation before merge.");
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  main().catch((error) => { console.error(error); process.exitCode = 1; });
}
