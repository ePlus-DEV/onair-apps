import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type RadioSeoLevel = "home" | "area" | "country" | "station";

export interface RadioSeoRoute {
  loc: string;
  level: RadioSeoLevel;
  title?: string;
  description?: string;
  image?: string;
}

interface StationRecord {
  title?: string;
  description?: string;
  features?: string;
}

export const getRadioSeoRoutes = (
  rootDir: string = process.cwd(),
): RadioSeoRoute[] => {
  const radioDir = join(rootDir, "public", "radio");
  const routes: RadioSeoRoute[] = [{ loc: "/", level: "home" }];

  for (const areaEntry of readdirSync(radioDir, { withFileTypes: true })) {
    if (!areaEntry.isDirectory()) continue;

    const area = areaEntry.name;
    const areaDir = join(radioDir, area);
    const countryFiles = readdirSync(areaDir, { withFileTypes: true }).filter(
      (entry) => entry.isFile() && entry.name.endsWith(".json"),
    );

    // Some legacy asset folders live under public/radio (for example
    // public/radio/romania/*.png). They are not geographic areas and must not
    // become fake routes such as /romania.
    if (countryFiles.length === 0) continue;

    routes.push({ loc: `/${area}`, level: "area" });

    for (const countryFile of countryFiles) {
      const country = countryFile.name.replace(/\.json$/, "");
      const countryPath = join(areaDir, countryFile.name);

      routes.push({
        loc: `/${area}/${country}`,
        level: "country",
      });

      try {
        const stations = JSON.parse(
          readFileSync(countryPath, "utf8"),
        ) as Record<string, StationRecord>;

        for (const [station, data] of Object.entries(stations)) {
          routes.push({
            loc: `/${area}/${country}/${station}`,
            level: "station",
            title: data.title,
            description: data.description,
            image: data.features,
          });
        }
      } catch (error) {
        console.warn(
          `Unable to read radio catalog for ${area}/${country}:`,
          error,
        );
      }
    }

  }

  return routes;
};

export const getSitemapEntry = (route: RadioSeoRoute) => {
  switch (route.level) {
    case "home":
      return { loc: route.loc, priority: 1, changefreq: "daily" as const };
    case "area":
      return { loc: route.loc, priority: 0.8, changefreq: "weekly" as const };
    case "country":
      return { loc: route.loc, priority: 0.9, changefreq: "daily" as const };
    default:
      return { loc: route.loc, priority: 0.8, changefreq: "daily" as const };
  }
};
