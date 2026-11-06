import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('language selector delegates menu accessibility to Nuxt UI with controlled open state', async () => {
  const source = await readFile('components/lang/LangSwitcher.vue', 'utf8');
  assert.match(source, /<UDropdownMenu v-model:open="open"/);
  assert.doesNotMatch(source, /dropdown-content|tabindex="0"|document\.addEventListener/);
  assert.match(source, /open\.value = false;\s*await setLocale\(code\)/);
  assert.match(source, /route\.fullPath/);
  assert.match(source, /overflow-x-hidden/);
});

