import test from 'node:test';
import assert from 'node:assert/strict';
import { LISTENING_STATION_PAGE_SIZE, paginateListeningStations } from '../utils/listening-station-pagination.mjs';

const station = (n, ms = n * 1000) => ({ url: '/stations/' + n, title: 'Đài ' + n, ms, rank: n });
const get = (items, options) => paginateListeningStations(items, options);

test('empty, one and two stations never invent placeholders or extra pages', () => {
  for (const n of [0, 1, 2, 3]) {
    const result = get(Array.from({ length: n }, (_, i) => station(i + 1)));
    assert.equal(result.items.length, n);
    assert.equal(result.total, n);
    assert.equal(result.totalPages, 1);
    assert.equal(result.hasNext, false);
    assert.equal(result.from, n ? 1 : 0);
    assert.equal(result.to, n);
  }
});

test('20 and 23 stations produce bounded 10-item pages, including final short page', () => {
  const twenty = Array.from({ length: 20 }, (_, i) => station(i + 1));
  const twentyThree = Array.from({ length: 23 }, (_, i) => station(i + 1));
  assert.equal(LISTENING_STATION_PAGE_SIZE, 10);
  assert.deepEqual([1, 2].map(page => get(twenty, { page }).items.length), [10, 10]);
  assert.equal(get(twenty, { page: 3 }).currentPage, 2, 'stale page is clamped');
  assert.deepEqual([1, 2, 3].map(page => get(twentyThree, { page }).items.length), [10, 10, 3]);
  assert.equal(get(twentyThree, { page: 3 }).from, 21);
  assert.equal(get(twentyThree, { page: 3 }).to, 23);
  assert.equal(get(twentyThree, { page: 3 }).hasNext, false);
});

test('name search is Vietnamese accent insensitive and paging recalculates', () => {
  const sample = [
    { url: '/1', title: 'Đài Giao Thông', ms: 20000 },
    { url: '/2', title: 'Radio Pop', ms: 30000 },
    { url: '/3', title: 'Dai Sai Gon', ms: 10000 },
  ];
  const result = get(sample, { query: 'dai', page: 20 });
  assert.equal(result.total, 2);
  assert.equal(result.currentPage, 1);
  assert.deepEqual(result.items.map(s => s.url), ['/1', '/3']);
  assert.equal(get(sample, { query: 'nothing' }).total, 0);
});

test('sorting never mutates store data; ties use stable names', () => {
  const source = [
    { url: '/2', title: 'Beta', ms: 1000 },
    { url: '/1', title: 'Alpha', ms: 1000 },
    { url: '/3', title: 'Zulu', ms: 2000 },
  ];
  assert.deepEqual(get(source).items.map(s => s.url), ['/3', '/1', '/2']);
  assert.deepEqual(get(source, { sort: 'duration-asc' }).items.map(s => s.url), ['/1', '/2', '/3']);
  assert.deepEqual(get(source, { sort: 'name-asc' }).items.map(s => s.url), ['/1', '/2', '/3']);
  assert.deepEqual(source.map(s => s.url), ['/2', '/1', '/3']);
});

test('invalid page or page size is bounded', () => {
  const sample = Array.from({ length: 25 }, (_, i) => station(i + 1));
  assert.equal(get(sample, { page: -10, pageSize: -3 }).items.length, 10);
  assert.equal(get(sample, { page: 999 }).currentPage, 3);
  assert.equal(get(sample, { page: 2.5 }).currentPage, 1);
});
