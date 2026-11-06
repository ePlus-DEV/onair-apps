import test from "node:test";
import assert from "node:assert/strict";

import { getAdjacentStation } from "../utils/station-navigation.mjs";

const stations = [
  { id: "a", title: "A" },
  { id: "b", title: "B" },
  { id: "c", title: "C" },
];

test("moves to previous and next station", () => {
  assert.equal(getAdjacentStation(stations, "b", -1)?.id, "a");
  assert.equal(getAdjacentStation(stations, "b", 1)?.id, "c");
});

test("wraps around at both ends", () => {
  assert.equal(getAdjacentStation(stations, "a", -1)?.id, "c");
  assert.equal(getAdjacentStation(stations, "c", 1)?.id, "a");
});

test("falls back predictably when active station is missing", () => {
  assert.equal(getAdjacentStation(stations, "missing", 1)?.id, "a");
  assert.equal(getAdjacentStation(stations, "missing", -1)?.id, "c");
});

test("does not navigate when fewer than two stations are available", () => {
  assert.equal(getAdjacentStation([], "a", 1), undefined);
  assert.equal(getAdjacentStation([{ id: "a" }], "a", 1), undefined);
});
