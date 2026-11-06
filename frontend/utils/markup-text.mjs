// Text-only markup handling for third-party radio metadata and XML sitemap checks.
// This utility does NOT sanitize HTML for rendering: never pass its output to v-html.

const TEXT_ENTITIES = {
  amp: '&',
  apos: "'",
  quot: '"',
  lt: '<',
  gt: '>',
  nbsp: ' ',
  '#39': "'",
};

/** Decode each entity at most once. In particular &amp;quot; must remain &quot;. */
export function decodeTextEntitiesOnce(value) {
  return String(value ?? '').replace(/&(?:amp|apos|quot|lt|gt|nbsp|#39);/gi, (entity) =>
    TEXT_ENTITIES[entity.slice(1, -1).toLowerCase()] ?? entity);
}

/** Extract plain text; never use a tag-matching regular expression as an HTML sanitizer. */
export function stripMarkupToText(value) {
  const markup = String(value ?? '');
  let output = '';
  let index = 0;
  let skippedRawTag = '';

  while (index < markup.length) {
    if (markup[index] !== '<') {
      if (!skippedRawTag) output += markup[index];
      index++;
      continue;
    }

    // Skip comment content, including its markup-like text.
    if (markup.startsWith('<!--', index)) {
      const close = markup.indexOf('-->', index + 4);
      index = close === -1 ? markup.length : close + 3;
      if (!skippedRawTag) output += ' ';
      continue;
    }

    let cursor = index + 1;
    const closing = markup[cursor] === '/';
    if (closing) cursor++;
    if (!/[a-z]/i.test(markup[cursor] ?? '')) {
      if (!skippedRawTag) output += markup[index];
      index++;
      continue;
    }

    const nameStart = cursor;
    while (/[a-z0-9:-]/i.test(markup[cursor] ?? '')) cursor++;
    const name = markup.slice(nameStart, cursor).toLowerCase();
    if (!/[\s/>]/.test(markup[cursor] ?? '')) {
      if (!skippedRawTag) output += markup[index];
      index++;
      continue;
    }

    // A '>' inside a quoted attribute does not end a tag.
    let quote = '';
    while (cursor < markup.length) {
      const character = markup[cursor];
      if (quote) {
        if (character === quote) quote = '';
      } else if (character === '"' || character === "'") {
        quote = character;
      } else if (character === '>') {
        break;
      }
      cursor++;
    }
    if (cursor === markup.length) break;

    const selfClosing = markup.slice(index, cursor).trimEnd().endsWith('/');
    index = cursor + 1;
    if (closing && name === skippedRawTag) skippedRawTag = '';
    else if (!closing && !selfClosing && !skippedRawTag && (name === 'script' || name === 'style')) {
      skippedRawTag = name;
    }
    if (!skippedRawTag) output += ' ';
  }

  return decodeTextEntitiesOnce(output).replace(/\s+/g, ' ').trim();
}
