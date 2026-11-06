import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface RadioAreaStats {
  slug: string;
  countries: number;
  stations: number;
}

export interface RadioCatalogStats {
  areas: number;
  countries: number;
  stations: number;
  byArea: RadioAreaStats[];
  byCountry: Record<string, number>;
}

export const getRadioCatalogStats = (
  rootDir: string = process.cwd(),
): RadioCatalogStats => {
  const radioDir = join(rootDir, "public", "radio");
  const byArea: RadioAreaStats[] = [];
  const byCountry: Record<string, number> = {};

  for (const areaEntry of readdirSync(radioDir, { withFileTypes: true })) {
    if (!areaEntry.isDirectory()) continue;

    const areaDir = join(radioDir, areaEntry.name);
    const countryFiles = readdirSync(areaDir, { withFileTypes: true }).filter(
      (entry) => entry.isFile() && entry.name.endsWith(".json"),
    );

    if (countryFiles.length === 0) continue;

    let stations = 0;
    for (const countryFile of countryFiles) {
      try {
        const catalog = JSON.parse(
          readFileSync(join(areaDir, countryFile.name), "utf8"),
        ) as Record<string, unknown>;
        const count = Object.keys(catalog).length;
        stations += count;
        byCountry[`/${areaEntry.name}/${countryFile.name.slice(0, -5)}`] = count;
      } catch (error) {
        console.warn(
          "Unable to count radio catalog " +
            areaEntry.name +
            "/" +
            countryFile.name +
            ":",
          error,
        );
      }
    }

    byArea.push({
      slug: areaEntry.name,
      countries: countryFiles.length,
      stations,
    });
  }

  byArea.sort((a, b) => a.slug.localeCompare(b.slug));

  return {
    areas: byArea.length,
    countries: byArea.reduce((total, area) => total + area.countries, 0),
    stations: byArea.reduce((total, area) => total + area.stations, 0),
    byArea,
    byCountry,
  };
};
