import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, chmod, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

async function preflight(file, name) {
  const yaml = await readFile(new URL('../.github/workflows/' + file, import.meta.url), 'utf8');
  const step = yaml.slice(yaml.indexOf('- name: ' + name));
  return step.match(/        run: \|\n([\s\S]*?)(?=\n      - )/)[1]
    .split('\n').map(line => line.replace(/^          /, '')).join('\n');
}

test('queued PR preflight skips closed/superseded runs and validates the current PR base', async () => {
  const root = await mkdtemp(join(tmpdir(), 'onair-run-freshness-'));
  try {
    const shim = join(root, 'gh');
    await writeFile(shim, '#!/usr/bin/env node\nprocess.stdout.write(process.env.GH_FIXTURE + "\\n");\n');
    await chmod(shim, 0o755);
    const script = await preflight('build.yml', '"Confirm live PR base before expensive CI"');
    for (const [fixture, expected, status] of [
      ['develop\thead-current\topen', 'run=true', 0],
      ['develop\thead-newer\topen', 'run=false', 0],
      ['develop\thead-current\tclosed', 'run=false', 0],
      ['main\thead-current\topen', 'run=true', 1],
    ]) {
      const output = join(root, 'outputs'); await writeFile(output, '');
      const result = spawnSync('bash', ['-c', script], { encoding: 'utf8', env: {
        ...process.env, PATH: root + ':' + process.env.PATH,
        GH_FIXTURE: fixture, EVENT_BASE_REF: 'develop', EVENT_HEAD_SHA: 'head-current',
        PR_NUMBER: '1', GITHUB_REPOSITORY: 'example/repo', GITHUB_OUTPUT: output,
      } });
      assert.equal(result.status, status, result.stderr);
      assert.ok((await readFile(output, 'utf8')).includes(expected));
    }
    const deployScript = await preflight('deploy-github-pages.yml', 'Skip an obsolete queued website release');
    for (const [fixture, expected] of [['head-current', 'run=true'], ['head-newer', 'run=false']]) {
      const output = join(root, 'outputs'); await writeFile(output, '');
      const result = spawnSync('bash', ['-c', deployScript], { encoding: 'utf8', env: {
        ...process.env, PATH: root + ':' + process.env.PATH, GH_FIXTURE: fixture,
        GITHUB_REPOSITORY: 'example/repo', GITHUB_REF_NAME: 'main',
        GITHUB_SHA: 'head-current', GITHUB_OUTPUT: output,
      } });
      assert.equal(result.status, 0, result.stderr);
      assert.ok((await readFile(output, 'utf8')).includes(expected));
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});
