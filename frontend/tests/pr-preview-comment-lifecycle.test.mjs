import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync(new URL('../.github/workflows/pr-preview-pages.yml', import.meta.url), 'utf8');
const status = workflow.split('  comment_status:')[1]?.split('  preview_config:')[0];
const build = workflow.split('  build:')[1]?.split('  publish:')[0];
const publish = workflow.split('  publish:')[1]?.split('  finalize_comment:')[0];
const failure = workflow.split('  finalize_comment:')[1]?.split('  cleanup:')[0];

test('every eligible PR event hides previous Preview URL before rebuilding', () => {
  assert.match(workflow, /types: \[opened, reopened, synchronize, closed\]/);
  assert.ok(status, 'trusted status job must exist');
  assert.match(status, /pull-requests: write/);
  assert.match(status, /github\.event\.pull_request\.head\.repo\.full_name == github\.repository/);
  assert.match(status, /name: "Hide Preview URL while building or after PR closure"/);
  assert.match(status, /Building preview/);
  assert.match(status, /Preview expired/);
  assert.match(status, /onair-pr-preview/);
  assert.match(status, /onair-preview-head:/);
  assert.match(status, /onair-preview-run:/);
  assert.doesNotMatch(status, /\[Open preview\]|PREVIEW_SITE_ORIGIN|PAGES_DEPLOY_TOKEN|actions\/checkout/,
    'pending/closed comments cannot disclose an old Preview link or touch secrets/code');
  assert.match(build, /needs: \[preview_config, comment_status\]/);
  assert.match(build, /needs\.comment_status\.result == 'success'/);
});

test('successful publish comments only after live SHA, noindex and head verification', () => {
  assert.ok(publish, 'publish job must exist');
  const live = publish.indexOf('Verify live GitHub Pages preview before commenting');
  const ready = publish.indexOf('Show Preview link only after live verification of the current PR/run');
  assert.ok(live >= 0 && ready > live, 'ready link must be gated behind public URL verification');
  assert.match(publish, /published_sha.*EXPECTED_HEAD/);
  assert.match(publish, /grep -q 'noindex'/);
  assert.match(publish, /read -r state base head repo/);
  assert.match(publish, /head" != "\$EXPECTED_HEAD"/);
  assert.match(publish, /onair-preview-run:\$GITHUB_RUN_ID/);
  assert.match(publish, /\[Open preview\]\(%s\)/);
  assert.match(publish, /gh api -X PATCH/);
  assert.doesNotMatch(publish, /gh api -X POST "repos\/\$GITHUB_REPOSITORY\/issues\/\$PR_NUMBER\/comments"/,
    'publish must only restore a link in the status comment of this run');
});

test('failure and PR closure leave no Preview hyperlink in the bot comment', () => {
  assert.ok(failure, 'failure finalizer must exist');
  assert.match(failure, /always\(\)/);
  assert.match(failure, /needs\.publish\.result != 'success'/);
  assert.match(failure, /Preview unavailable/);
  assert.match(failure, /onair-preview-run:\$GITHUB_RUN_ID/);
  assert.doesNotMatch(failure, /\[Open preview\]|PREVIEW_SITE_ORIGIN/);
  assert.match(status, /\[ "\$EVENT_ACTION" = closed \]/);
  assert.match(status, /\[ "\$state" != closed \]/);
});

test('status/finalizer jobs never receive PR code or Preview deployment secrets', () => {
  for (const [name, section] of [['comment_status', status], ['finalize_comment', failure]]) {
    assert.ok(section, name);
    assert.doesNotMatch(section, /actions\/checkout|npm ci|secrets\.PAGES_DEPLOY_TOKEN|environment:\s*\n\s*name:/,
      name + ' must be metadata-only and credential-free');
  }
  assert.match(build, /persist-credentials: false/);
  assert.doesNotMatch(build, /secrets\.PAGES_DEPLOY_TOKEN/);
});
