import { stationOgDeployment } from "./utils/station-og-deployment.mjs";
import { defineNuxtConfig } from "nuxt/config";
import { prefixPublicAsset } from "./utils/public-site-path.mjs";
import { isPrPreviewBuild, PR_PREVIEW_ROUTES } from "./utils/pr-preview.mjs";
import { isStagingDeployment } from "./utils/seo-deployment.mjs";
import { resolveDeploymentSiteName } from "./utils/deployment-site-name.mjs";
import { GA4_MEASUREMENT_ID, isGa4ProductionBuild, getGa4HeadScripts } from "./utils/ga4-config.mjs";
import { getRadioSeoRoutes, getSitemapEntry } from "./build/radioRoutes";
import { getGlobalRadioRoutes } from "./build/globalRadioRoutes";
import { getRadioCatalogStats } from "./build/radioStats";
import {
  brandIcons,
  freeSolidIcons,
} from "./config/fontawesome-icons.mjs";

const algoliaApplicationId =
  process.env.NUXT_PUBLIC_ALGOLIA_APPLICATION_ID ||
  process.env.ALGOLIA_APPLICATION_ID ||
  "";
const algoliaApiKey =
  process.env.NUXT_PUBLIC_ALGOLIA_API_KEY ||
  process.env.ALGOLIA_API_KEY ||
  "";
const hasAlgoliaConfig = Boolean(algoliaApplicationId && algoliaApiKey);
const isPrPreview = isPrPreviewBuild();
const isNativeAppBuild = process.env.ONAIR_NATIVE_APP === 'true';
const baseURL = process.env.NUXT_APP_BASE_URL || "/";
const staticAsset = (path: string) => prefixPublicAsset(path, baseURL);
const siteUrl = (process.env.NUXT_PUBLIC_SITE_URL || "https://radio.eplus.dev").replace(
  /\/$/,
  "",
);
// Only the staging deployment's two existing NUXT_PUBLIC_* variables control
// indexability. Never infer it from NODE_ENV, a Git checkout or a custom env.
const noIndex = isStagingDeployment({
  siteUrl,
  noIndex: process.env.NUXT_PUBLIC_NO_INDEX,
});
// Nuxt production builds also power previews; require our canonical public origin.
// Analytics depends on the canonical production origin, not SEO noindex.
const ga4Enabled = !isNativeAppBuild && isGa4ProductionBuild({
  nodeEnv: process.env.NODE_ENV,
  siteUrl,
});
const stationOg = stationOgDeployment({ siteUrl, noIndex: noIndex ? "true" : "false" });
const siteName = resolveDeploymentSiteName({
  siteUrl,
  configuredName: process.env.NUXT_PUBLIC_SITE_NAME,
  isPrPreview,
});
const defaultDescription =
  process.env.DESCRIPTION ||
  "ePlus OnAir — Listen Beyond Borders. Discover and listen to live radio stations from around the world.";
const radioSeoRoutes = getRadioSeoRoutes();
const radioCatalogStats = getRadioCatalogStats();
const staticSeoRoutes = [
  ...getGlobalRadioRoutes(),
  { loc: "/about", priority: 0.5, changefreq: "monthly" as const },
  { loc: "/statistics", priority: 0.6, changefreq: "daily" as const },
  { loc: "/contact", priority: 0.4, changefreq: "monthly" as const },
  { loc: "/privacy-policy", priority: 0.3, changefreq: "yearly" as const },
  { loc: "/terms-of-use", priority: 0.3, changefreq: "yearly" as const },
  { loc: "/cookie-policy", priority: 0.3, changefreq: "yearly" as const },
];

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2024-04-03",
  // Keep the current Nuxt 3-style root directories during the framework upgrade.
  srcDir: ".",
  dir: {
    app: "app",
  },
  site: {
    url: siteUrl,
    name: siteName,
  },
  // Nuxt DevTools imports Simple Git's legacy default export, so keep the
  // Simple Git override on the 3.x line until DevTools supports Simple Git 4.
  // DevTools 3.4.4+ no longer depends on vulnerable simple-git 3.x.
  // Keep the developer experience without restoring a vulnerable override.
  devtools: { enabled: true },
  ssr: !isNativeAppBuild,
  pages: true,
  // Thousands of prerendered station routes otherwise duplicate CSS in each
  // HTML document. Shared CSS assets are cached across pages and keep the
  // generated site within GitHub Pages' 1 GB published-site limit.
  features: {
    inlineStyles: false,
  },
  runtimeConfig: {
    public: {
      nativeApp: isNativeAppBuild,
      cloudinaryBaseUrl: process.env.NUXT_PUBLIC_CLOUDINARY_BASE_URL,
      pinChannelFavorites: process.env.NUXT_PUBLIC_PIN_CHANNEL_FAVORITES,
      corsServer: process.env.NUXT_PUBLIC_CORS_SERVER_1,
      // Optional approved ePlus API endpoint, never a TuneIn session proxy.
      globalRadioResolverUrl: process.env.NUXT_PUBLIC_GLOBAL_RADIO_RESOLVER_URL || '',
      placeholder: "https://s3.eplus.dev/i/radio-on-air.png",
      placeholderStation: "https://s3.eplus.dev/i/station-on-air.png",
      apiZingLiveStreamProgramDetail:
        process.env.NUXT_PUBLIC_API_ZING_LIVE_STREAM_PROGRAM_DETAIL,
      apiZingGetLyric: process.env.NUXT_PUBLIC_API_ZING_GET_LYRIC,
      x: process.env.NUXT_PUBLIC_X,
      facebook: process.env.NUXT_PUBLIC_FACEBOOK,
      github: process.env.NUXT_PUBLIC_GITHUB,
      copyright: process.env.NUXT_PUBLIC_COPYRIGHT,
      algoliaIndexStation: "radio.eplus.dev",
      algoliaIndexRadio: "world",
      algoliaConfigured: hasAlgoliaConfig,
      ga4Enabled,
      ga4MeasurementId: ga4Enabled ? GA4_MEASUREMENT_ID : "",
      siteUrl,
      siteName,
      defaultDescription,
      radioCatalogStats,
      noIndex,
      stationOgMode: stationOg.mode,
      stationOgBaseUrl: stationOg.baseUrl,
    },
  },
  css: ["~/assets/css/main.css"],
  ui: {
    fonts: false,
    experimental: { componentDetection: true },
  },
  // Client-only player controls must also work on the prerendered static host.
  icon: {
    provider: "none",
    clientBundle: { scan: true },
  },
  modules: [
    "@nuxt/ui",
    "@nuxtjs/color-mode",
    "@vesp/nuxt-fontawesome",
    "@nuxtjs/i18n",
    "@nuxt/image",
    "dayjs-nuxt",
    ...(!noIndex ? ["@nuxtjs/sitemap"] : []),
    "@nuxtjs/algolia",
    "@pinia/nuxt",
  ],
  algolia: {
    // Always register the module so its composables are generated even when
    // deployment credentials are not available during the build phase.
    applicationId: algoliaApplicationId || "disabled",
    apiKey: algoliaApiKey || "disabled",
  },
  app: {
    // Nuxt must use the GitHub Pages PROJECT subpath until a custom domain is
    // configured. "/" remains the default for DigitalOcean and local builds.
    baseURL,
    head: {
      titleTemplate: `%s | ${siteName}`,
      // Install the Google tag in prerendered HTML, not after Nuxt hydration.
      // The bootstrap checks the canonical hostname again for PR previews.
      script: getGa4HeadScripts(ga4Enabled),
      meta: [
        { charset: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        ...(noIndex ? [{ name: "robots", content: "noindex, nofollow, noarchive" }] : []),
        { name: "msapplication-TileColor", content: "#101119" },
        ...(!noIndex ? [
          { property: "article:author", content: process.env.FANPAGE },
          { property: "article:publisher", content: process.env.FANPAGE },
          { property: "fb:pages", content: "179495025583990" },
          { property: "fb:app_id", content: "363745774395676" },
        ] : []),
      ],
      link: [
        {
          rel: "apple-touch-icon",
          sizes: "180x180",
          href: staticAsset("/brand/apple-touch-icon.png"),
        },
        {
          rel: "icon",
          type: "image/x-icon",
          href: staticAsset("/favicon.ico?v=onair-20261012"),
        },
        {
          rel: "icon",
          type: "image/png",
          sizes: "32x32",
          href: staticAsset("/brand/favicon-32x32.png?v=onair-20261012"),
        },
        {
          rel: "icon",
          type: "image/png",
          sizes: "16x16",
          href: staticAsset("/brand/favicon-16x16.png?v=onair-20261012"),
        },
        { rel: "manifest", href: staticAsset("/brand/site.webmanifest") },
        {
          rel: "mask-icon",
          color: "#e11d48",
          href: staticAsset("/brand/safari-pinned-tab.svg"),
        },
      ],
    },
  },
  i18n: {
    restructureDir: ".",
    locales: [
      {
        code: "en",
        file: "en-US.json",
        name: "English",
        flag: "/img/europe/flags/united-kingdom.png",
      },
      {
        code: "vi",
        file: "vi-VN.json",
        name: "Tiếng Việt",
        flag: "/img/asia/flags/viet-nam.png",
      },
      {
        code: "ja",
        file: "ja-JP.json",
        name: "日本語",
        flag: "/img/asia/flags/japan.png",
      },
      {
        code: "zh-CN",
        file: "zh-CN.json",
        name: "简体中文",
        flag: "/img/asia/flags/china.png",
      },
      {
        code: "zh-TW",
        file: "zh-TW.json",
        name: "繁體中文",
        flag: "/img/asia/flags/taiwan.png",
      },
      {
        code: "fr",
        file: "fr-FR.json",
        name: "Français",
        flag: "/img/europe/flags/france.png",
      },
      {
        code: "ru",
        file: "ru-RU.json",
        name: "Русский",
        flag: "/img/europe/flags/russia.png",
      },
    ],
    strategy: "no_prefix",
    lazy: true,
    langDir: "lang/",
    defaultLocale: "en",
  },
  fontawesome: {
    component: "fa",
    icons: {
      solid: freeSolidIcons,
      brands: brandIcons,
    },
  },
  dayjs: {
    locales: ["vi", "ja", "zh-cn", "zh-tw", "fr", "ru"],
    plugins: ["relativeTime", "utc", "timezone", "localizedFormat"],
    defaultLocale: "en",
    defaultTimezone: "America/New_York",
  },
  image: {
    cloudinary: {
      baseURL: `https://res.cloudinary.com/${process.env.CLOUDINARY_NAME}/image/fetch/`,
    },
    provider: process.env.NODE_ENV === "production" ? "cloudinary" : "ipx",
  },
  colorMode: {
    preference: "dark",
    fallback: "dark",
    classPrefix: "",
    classSuffix: "",
    storageKey: "theme",
  },
  nitro: {
    // Nitro 2.13.4's string externals rules never match Windows ids with
    // backslashes (nitrojs/nitro#4732, nuxt/nuxt#36467), so the Nuxt server
    // renderer is left external and `nuxt/internal/manifest` resolves to a
    // stub, breaking every SSR page with "Either manifest or precomputed data
    // must be provided". Mirror the critical inline rules as
    // separator-agnostic regexes until a Nitro release ships the fix.
    externals: {
      inline: [
        /node_modules[\\/]nuxt[\\/]dist[\\/]/,
        /node_modules[\\/]@nuxt[\\/]nitro-server[\\/]dist[\\/]/,
      ],
    },
    prerender: {
      // Only preview builds limit routes: one full catalog per PR would exceed
      // the GitHub Pages 1 GB site limit. Production/staging remain unchanged.
      crawlLinks: !isPrPreview && !isNativeAppBuild,
      routes: isNativeAppBuild ? ['/'] : isPrPreview ? [...PR_PREVIEW_ROUTES, '/robots.txt'] : [
        ...radioSeoRoutes.map((route) => route.loc),
        ...staticSeoRoutes.map((route) => route.loc),
        "/library",
        "/settings",
        "/robots.txt",
        ...(!noIndex ? ["/sitemap.xml"] : []),
      ],
    },
  },
  sitemap: {
    // XSLT is being removed from Chromium; keep the XML readable to crawlers
    // without attaching a browser-only presentation stylesheet.
    xsl: false,
    // The site serves all languages at the same unprefixed URL, so there
    // are no distinct localized routes to advertise as hreflang alternatives.
    autoI18n: false,
    // A checkout/build timestamp is not a trustworthy page modified date.
    autoLastmod: false,
    urls: noIndex ? [] : [
      ...radioSeoRoutes.map((route) => ({
        ...getSitemapEntry(route),
        loc: `${siteUrl}${route.loc}`,
      })),
      ...staticSeoRoutes.map((route) => ({
        ...route,
        loc: `${siteUrl}${route.loc}`,
      })),
    ],
  },
  vue: {
    compilerOptions: {
      isCustomElement: (tag) => tag.startsWith("media-"),
    },
  },
});

