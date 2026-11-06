import test from "node:test";
import assert from "node:assert/strict";

import { buildBreadcrumbItems } from "../utils/breadcrumbs.mjs";

test("builds area breadcrumb without fake empty levels", () => {
  assert.deepEqual(
    buildBreadcrumbItems({
      area: "asia",
      areaLabel: "Asia",
    }),
    [
      { id: "area", label: "Asia", to: undefined },
    ],
  );
});

test("builds country breadcrumb with linked area and current country", () => {
  assert.deepEqual(
    buildBreadcrumbItems({
      area: "asia",
      areaLabel: "Asia",
      countrySlug: "viet-nam",
      countryLabel: "Vietnam",
    }),
    [
      { id: "area", label: "Asia", to: "/asia" },
      { id: "country", label: "Vietnam", to: undefined },
    ],
  );
});

test("builds station breadcrumb with ancestor links and current station", () => {
  assert.deepEqual(
    buildBreadcrumbItems({
      area: "asia",
      areaLabel: "Asia",
      countrySlug: "viet-nam",
      countryLabel: "Vietnam",
      currentLabel: "EDM Radio - Zing MP3",
    }),
    [
      { id: "area", label: "Asia", to: "/asia" },
      { id: "country", label: "Vietnam", to: "/asia/viet-nam" },
      { id: "current", label: "EDM Radio - Zing MP3", to: undefined },
    ],
  );
});
