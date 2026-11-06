const cleanSiteUrl = (siteUrl) =>
  String(siteUrl || "").replace(/\/$/, "");

export const absoluteUrl = (siteUrl, path = "/") => {
  const base = cleanSiteUrl(siteUrl);
  const value = String(path || "/");

  if (/^https?:\/\//i.test(value)) return value;
  return `${base}${value.startsWith("/") ? value : `/${value}`}`;
};

export const buildBreadcrumbSchema = (siteUrl, items = []) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items
    .filter((item) => item?.name && item?.path)
    .map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(siteUrl, item.path),
    })),
});

export const buildCollectionPageSchema = ({
  siteUrl,
  path,
  name,
  description,
  items = [],
  maxItems = 100,
}) => ({
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name,
  description,
  url: absoluteUrl(siteUrl, path),
  mainEntity: {
    "@type": "ItemList",
    numberOfItems: items.length,
    itemListElement: items.slice(0, maxItems).map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(siteUrl, item.path),
    })),
  },
});

export const buildRadioStationSchema = ({
  siteUrl,
  path,
  name,
  description,
  image,
}) => ({
  "@context": "https://schema.org",
  "@type": "RadioStation",
  "@id": `${absoluteUrl(siteUrl, path)}#station`,
  name,
  description,
  url: absoluteUrl(siteUrl, path),
  image: absoluteUrl(siteUrl, image),
});
