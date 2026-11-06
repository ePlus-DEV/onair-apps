// One responsive skeleton per actual Nuxt route family. This is intentionally
// display-only: no catalog request, player state or search/SEO side effects.
export function pageSkeletonKind(path = "/") {
  const value = String(path || "/").split(/[?#]/, 1)[0].replace(/\/+$/, "") || "/";
  if (value === "/") return "home";
  const parts = value.split("/").filter(Boolean);
  if (parts.length === 1) {
    if (parts[0] === "library") return "library";
    if (parts[0] === "statistics") return "statistics";
    if (["about", "contact", "privacy-policy", "terms-of-use", "cookie-policy"].includes(parts[0])) return "info";
    return "area";
  }
  if (parts.length === 2) return "country";
  if (parts.length === 3) return "station";
  return "info";
}
