import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('the public .env.example does not contain credential values', async () => {
  const content = await read('.env.example');
  assert.doesNotMatch(content, /dop_v1_[a-z0-9]+/i);
  assert.doesNotMatch(content, /(?:ghp_|gho_|github_pat_)[a-zA-Z0-9_]+/);
  assert.doesNotMatch(content, /(?:sk_live_|sk_test_)[a-zA-Z0-9]+/);
  assert.doesNotMatch(content, /^\s*(?:CLOUDINARY_API_SECRET|CLOUDINARY_API_KEY|ALGOLIA_WRITE_API_KEY|NUXT_PUBLIC_DIGITALOCEAN_API_KEY)\s*=/m);
  for (const line of content.split('\n')) {
    if (line.startsWith('#')) continue;
    const match = line.match(/^\s*([\w]+(?:API_KEY|API_SECRET|TOKEN|PASSWORD))\s*=\s*(.*)$/i);
    if (match) assert.ok(/^(?:""|'')?$/.test(match[2].trim()),
      `Credential placeholder for ${match[1]} must remain empty`);
  }
});

test('Nuxt public runtime config must never export administrative provider credentials', async () => {
  const config = await read('nuxt.config.ts');
  assert.doesNotMatch(config, /digitaloceanApiKey\s*:/);
  assert.doesNotMatch(config, /NUXT_PUBLIC_DIGITALOCEAN_API_KEY/);
  assert.doesNotMatch(config, /CLOUDINARY_API_SECRET/);
  const readme = await read('README.md');
  assert.doesNotMatch(readme, /This \*\*private repository\*\*/);
  assert.match(readme, /SECURITY\.md/);
});

test('public security and contribution policy are documented', async () => {
  const [policy, guide] = await Promise.all([read('SECURITY.md'), read('CONTRIBUTING.md')]);
  assert.match(policy, /revoke or rotate/i);
  assert.match(policy, /NUXT_PUBLIC_\*/);
  assert.match(guide, /develop/);
  assert.match(guide, /npm test/);
});
