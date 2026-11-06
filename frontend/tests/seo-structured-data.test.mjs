import test from "node:test";
import assert from "node:assert/strict";

import {
  absoluteUrl,
  buildBreadcrumbSchema,
  buildCollectionPageSchema,
  buildRadioStationSchema,
} from "../utils/seo-structured-data.mjs";

const site = "https://radio.eplus.dev/";

test("builds canonical absolute URLs", () => {
  assert.equal(absoluteUrl(site, "/asia"), "https://radio.eplus.dev/asia");
  assert.equal(
    absoluteUrl(site, "https://cdn.example/station.png"),
    "https://cdn.example/station.png",
  );
});

test("builds breadcrumb structured data with positions", () => {
  const schema = buildBreadcrumbSchema(site, [
    { name: "Home", path: "/" },
    { name: "Asia", path: "/asia" },
    { name: "Vietnam", path: "/asia/viet-nam" },
  ]);

  assert.equal(schema["@type"], "BreadcrumbList");
  assert.equal(schema.itemListElement.length, 3);
  assert.equal(schema.itemListElement[2].position, 3);
  assert.equal(
    schema.itemListElement[2].item,
    "https://radio.eplus.dev/asia/viet-nam",
  );
});

test("builds collection schema without exploding very large station catalogs", () => {
  const items = Array.from({ length: 140 }, (_, index) => ({
    name: `Station ${index + 1}`,
    path: `/asia/viet-nam/station-${index + 1}`,
  }));
  const schema = buildCollectionPageSchema({
    siteUrl: site,
    path: "/asia/viet-nam",
    name: "Live Radio in Vietnam",
    description: "Vietnam radio stations",
    items,
  });

  assert.equal(schema.mainEntity.numberOfItems, 140);
  assert.equal(schema.mainEntity.itemListElement.length, 100);
});

test("builds RadioStation schema with an absolute image", () => {
  const schema = buildRadioStationSchema({
    siteUrl: site,
    path: "/asia/viet-nam/example",
    name: "Example Radio",
    description: "Listen live",
    image: "/img/example.png",
  });

  assert.equal(schema["@type"], "RadioStation");
  assert.equal(schema.image, "https://radio.eplus.dev/img/example.png");
  assert.equal(
    schema["@id"],
    "https://radio.eplus.dev/asia/viet-nam/example#station",
  );
});
