import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('staging and production Pages builds receive the approved global-radio resolver URL', async () => {
  const workflow = await read('.github/workflows/deploy-github-pages.yml');
  const config = await read('nuxt.config.ts');
  assert.match(workflow, /environment:\s*\n\s*name:.*development/);
  assert.match(workflow, /NUXT_PUBLIC_GLOBAL_RADIO_RESOLVER_URL:\s*\$\{\{\s*vars\.NUXT_PUBLIC_GLOBAL_RADIO_RESOLVER_URL\s*\}\}/);
  assert.match(workflow, /Nuxt static output captures NUXT_PUBLIC/);
  assert.match(config, /globalRadioResolverUrl:\s*process\.env\.NUXT_PUBLIC_GLOBAL_RADIO_RESOLVER_URL\s*\|\|\s*''/);
});

test('missing CORS and optional resolver are reported without blocking ordinary radio deployment', async () => {
  const workflow = await read('.github/workflows/deploy-github-pages.yml');
  assert.match(workflow, /Explain Global Radio activation status/);
  assert.match(workflow, /NUXT_PUBLIC_CORS_SERVER_1 is unset/);
  assert.match(workflow, /No Global Radio resolver configured/);
  assert.match(workflow, /NUXT_PUBLIC_CORS_SERVER_1 must be an HTTPS proxy origin/);
  assert.match(workflow, /NUXT_PUBLIC_GLOBAL_RADIO_RESOLVER_URL must be a full HTTPS endpoint/);
  assert.doesNotMatch(workflow, /NUXT_PUBLIC_GLOBAL_RADIO_RESOLVER_URL:\s*https:\/\//);
});
