import test from 'node:test';
import assert from 'node:assert/strict';
import { LIBRARY_TAB_VALUES, libraryTabFromHash, libraryTabHref } from '../utils/library-tabs.mjs';

test('library URL hash selects only recognized sections', () => {
  assert.deepEqual(LIBRARY_TAB_VALUES, ['favorites', 'recent', 'stats']);
  for (const value of LIBRARY_TAB_VALUES) {
    assert.equal(libraryTabFromHash(`#${value}`), value);
    assert.equal(libraryTabHref(value), `/library#${value}`);
  }
  for (const value of ['', '#', '#all', '#other', 'recent', '#RECENT', '#stats?invalid', null, undefined, 123]) {
    assert.equal(libraryTabFromHash(value), 'all');
  }
});

test('all tab has a clean URL and unsupported values cannot inject a hash or route', () => {
  assert.equal(libraryTabHref('all'), '/library');
  assert.equal(libraryTabHref(''), '/library');
  assert.equal(libraryTabHref('#stats'), '/library');
  assert.equal(libraryTabHref('../about'), '/library');
  assert.equal(libraryTabHref(null), '/library');
});
