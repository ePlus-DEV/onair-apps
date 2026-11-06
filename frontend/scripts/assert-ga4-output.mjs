import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { GA4_MEASUREMENT_ID } from '../utils/ga4-config.mjs';

/**
 * Read script elements from generated HTML without trying to parse HTML using
 * regular expressions (CodeQL's bad-html-filtering-regexp rule).
 *
 * Generated Nuxt markup is under our control. The small scanner understands
 * quoted opening-tag attributes and whitespace or attributes on end tags;
 * it also avoids interpreting script content as opening markup.
 */
const isHtmlSpace = (char) =>
  char === ' ' || char === '\t' || char === '\n' || char === '\r' || char === '\f';

const isTagBoundary = (char) =>
  char === undefined || char === '>' || char === '/' || isHtmlSpace(char);

function findTagEnd(html, from) {
  let quote = null;
  for (let pos = from; pos < html.length; pos++) {
    const char = html[pos];
    if (quote !== null) {
      if (char === quote) quote = null;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === '>') {
      return pos;
    }
  }
  return -1;
}

function readScriptElements(html) {
  const lower = html.toLowerCase();
  const scripts = [];
  let cursor = 0;

  while (cursor < html.length) {
    const start = lower.indexOf('<script', cursor);
    if (start < 0) break;
    const nameEnd = start + '<script'.length;
    if (!isTagBoundary(lower[nameEnd])) {
      cursor = nameEnd;
      continue;
    }

    const openEnd = findTagEnd(html, nameEnd);
    if (openEnd < 0) break;
    let closeStart = lower.indexOf('</script', openEnd + 1);
    while (closeStart >= 0 && !isTagBoundary(lower[closeStart + '</script'.length])) {
      closeStart = lower.indexOf('</script', closeStart + '</script'.length);
    }
    if (closeStart < 0) break;
    const closeEnd = findTagEnd(html, closeStart + '</script'.length);
    if (closeEnd < 0) break;

    scripts.push({
      start,
      openingTag: html.slice(start, openEnd + 1),
      content: html.slice(openEnd + 1, closeStart),
    });
    cursor = closeEnd + 1;
  }
  return scripts;
}

/**
 * Verify the actual prerendered HTML, not just the Nuxt source code.
 * The tag is in <head> before hydration, and the client-side hostname guard
 * is required because a production build may be mirrored to a preview URL.
 */
export async function assertGa4Output(root, target) {
  assert.ok(['production', 'staging', 'development'].includes(target), 'Expected production, staging or development');
  const pages = ['index.html', 'asia/viet-nam/vov-gt-hcm/index.html'];
  for (const page of pages) {
    const html = await readFile(join(root, page), 'utf8');
    const headEnd = html.toLowerCase().indexOf('</head');
    assert.ok(headEnd >= 0, page + ': missing HTML head');
    const head = html.slice(0, headEnd);
    const scripts = readScriptElements(html);
    const gaBootstraps = scripts.filter((script) => script.start < headEnd &&
      script.content.includes('www.googletagmanager.com/gtag/js?id='));
    const externalGaTags = scripts.filter((script) =>
      script.openingTag.toLowerCase().includes('www.googletagmanager.com/gtag/js'));

    assert.equal(externalGaTags.length, 0,
      page + ': no second unconditional Google tag script may be injected');

    if (target === 'production') {
      assert.equal(gaBootstraps.length, 1, page + ': missing or duplicate Google tag bootstrap');
      const code = gaBootstraps[0].content;
      assert.ok(code.includes("window.location.hostname !== 'radio.eplus.dev'"),
        page + ': preview-host protection missing');
      assert.ok(code.includes("window.gtag('config', '" + GA4_MEASUREMENT_ID + "')"),
        page + ': GA4 measurement ID mismatch or initial page_view disabled');
      assert.ok(code.includes('window.dataLayer = window.dataLayer || []'),
        page + ': gtag queue not initialized');
      assert.ok(code.includes('document.head.appendChild(tag)'),
        page + ': gtag.js script never loaded');
    } else {
      assert.equal(gaBootstraps.length, 0, page + ': non-production must not embed Google tag');
      assert.ok(!head.includes('googletagmanager.com/gtag/js'),
        page + ': non-production must not load Google tag');
    }
  }
  console.log('PASS: ' + target + ' prerendered pages have the correct single GA4 tag policy.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  assertGa4Output(process.argv[2] || '.output/public', process.argv[3])
    .catch((error) => { console.error(error); process.exitCode = 1; });
}
