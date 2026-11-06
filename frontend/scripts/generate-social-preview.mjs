import { mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

// The SVG is the editable, versioned artwork; export a crawler-compatible
// raster asset before Nuxt builds/prerenders. No external image host required.
export const socialPreviewSource = join(process.cwd(), "public/brand/social-preview.svg");
export const socialPreviewOutput = join(process.cwd(), "public/brand/social-preview.png");

export async function generateSocialPreview(source = socialPreviewSource, output = socialPreviewOutput) {
  await mkdir(dirname(output), { recursive: true });
  const { width, height, format } = await sharp(source)
    .resize(1200, 630)
    .png({ compressionLevel: 9 })
    .toFile(output);
  if (width !== 1200 || height !== 630 || format !== "png") {
    throw new Error("Unexpected social preview dimensions or format");
  }
  return output;
}

/**
 * Reuse only a valid PNG and only when Actions restored an exact-key cache.
 * The key covers the source SVG, renderer source and sharp lockfile.
 */
export async function cachedSocialPreviewValid(
  output = socialPreviewOutput,
  cacheHit = process.env.ONAIR_SOCIAL_PREVIEW_CACHE_HIT === "true",
) {
  if (!cacheHit) return false;
  try {
    const { width, height, format } = await sharp(output).metadata();
    return width === 1200 && height === 630 && format === "png";
  } catch {
    return false;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (await cachedSocialPreviewValid()) {
    console.log("Reused cached social-preview.png");
  } else {
    await generateSocialPreview();
  }
}
