import test from 'node:test';
import assert from 'node:assert/strict';
import { getPrPreviewBasePath, isPrPreviewBuild, PR_PREVIEW_ROUTES } from '../utils/pr-preview.mjs';

test('preview path is specific to one PR under the custom Pages domain', () => {
  assert.equal(getPrPreviewBasePath(358), '/pr-preview/pr-358/');
  assert.equal(getPrPreviewBasePath('1'), '/pr-preview/pr-1/');
  assert.equal(getPrPreviewBasePath(358, 'onair-pr-previews'), '/onair-pr-previews/pr-preview/pr-358/');
});

test('reject ambiguous / malicious preview paths', () => {
  for (const value of ['../2', '0', '-3', '1/path', '', 'abc', '1?x=1']) {
    assert.throws(() => getPrPreviewBasePath(value), /Invalid PR/, value);
  }
  assert.throws(() => getPrPreviewBasePath(4, '../other'), /Invalid PR/);
});

test('preview is explicit and never enabled accidentally on staging or production', () => {
  assert.equal(isPrPreviewBuild({}), false);
  assert.equal(isPrPreviewBuild({ ONAIR_PR_PREVIEW: 'false' }), false);
  assert.equal(isPrPreviewBuild({ ONAIR_PR_PREVIEW: 'true' }), true);
});

test('preview representative routes include main flows and a deep-linked station', () => {
  for (const route of ['/', '/asia/viet-nam/vov-gt-hcm', '/library', '/settings', '/statistics']) {
    assert.ok(PR_PREVIEW_ROUTES.includes(route), route);
  }
  assert.equal(new Set(PR_PREVIEW_ROUTES).size, PR_PREVIEW_ROUTES.length);
  assert.ok(PR_PREVIEW_ROUTES.length < 30, 'Preview should stay below the GitHub Pages size cap');
});
