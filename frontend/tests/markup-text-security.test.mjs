import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { decodeTextEntitiesOnce, stripMarkupToText } from '../utils/markup-text.mjs';

test('third-party station titles are extracted as plain text without tag regex filtering', () => {
  assert.equal(
    stripMarkupToText('<b>Vietnam</b> <i>Live</i> &amp; <span title="a > b">News</span>'),
    'Vietnam Live & News',
  );
  assert.equal(
    stripMarkupToText('Radio<!-- hidden <b>text</b> --> One'),
    'Radio One',
  );
  assert.equal(
    stripMarkupToText('<script type="text/javascript">alert("untrusted")</script><style>.hidden { display: none }</style><b>Safe</b>'),
    'Safe',
  );
});

test('HTML and sitemap XML entities are decoded exactly once', () => {
  assert.equal(decodeTextEntitiesOnce('A &amp; B &quot;C&quot; &apos;D&apos;'), 'A & B "C" \'D\'');
  assert.equal(decodeTextEntitiesOnce('&amp;quot;&amp;lt;'), '&quot;&lt;');
  assert.equal(stripMarkupToText('<strong>&amp;lt;img src=x&amp;gt;</strong>'), '&lt;img src=x&gt;');
  assert.equal(decodeTextEntitiesOnce('A &lt; B &gt; C'), 'A < B > C');
});

test('sitemap validation uses single-pass entity decoding before checking URL origins', async () => {
  const source = await readFile(new URL('../scripts/assert-sitemap-xml.mjs', import.meta.url), 'utf8');
  assert.match(source, /decodeTextEntitiesOnce\(m\[1\]\)/);
  assert.doesNotMatch(source, /replaceAll\("&amp;",/);
});

test('deployment workflow tests compare the complete legacy host, not a URL substring', async () => {
  const source = await readFile(new URL('./github-pages-publishing.test.mjs', import.meta.url), 'utf8');
  assert.match(source, /assert\.doesNotMatch\(workflow/);
  assert.match(source, /legacy GitHub Pages host must never be present/);
  assert.doesNotMatch(source, /workflow\.includes\('https:\/\/eplus-dev\.github\.io\/onair-/);
});
