const clean = (value) => String(value || "").trim();

export const buildBreadcrumbItems = ({
  area,
  areaLabel,
  countrySlug,
  countryLabel,
  currentLabel,
} = {}) => {
  const normalizedArea = clean(area);
  const normalizedAreaLabel = clean(areaLabel);
  const normalizedCountrySlug = clean(countrySlug);
  const normalizedCountryLabel = clean(countryLabel);
  const normalizedCurrentLabel = clean(currentLabel);

  const items = [];

  if (normalizedArea && normalizedAreaLabel) {
    items.push({
      id: "area",
      label: normalizedAreaLabel,
      to: normalizedCountrySlug ? `/${normalizedArea}` : undefined,
    });
  }

  if (
    normalizedArea &&
    normalizedCountrySlug &&
    normalizedCountryLabel
  ) {
    items.push({
      id: "country",
      label: normalizedCountryLabel,
      to: normalizedCurrentLabel
        ? `/${normalizedArea}/${normalizedCountrySlug}`
        : undefined,
    });
  }

  if (normalizedCountrySlug && normalizedCurrentLabel) {
    items.push({
      id: "current",
      label: normalizedCurrentLabel,
      to: undefined,
    });
  }

  return items;
};
