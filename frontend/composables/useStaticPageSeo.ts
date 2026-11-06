import type { ComputedRef, Ref } from "vue";

interface StaticPageSeoOptions {
  title: Ref<string> | ComputedRef<string>;
  description: Ref<string> | ComputedRef<string>;
  type?: "WebPage" | "AboutPage" | "ContactPage";
}

export const useStaticPageSeo = ({
  title,
  description,
  type = "WebPage",
}: StaticPageSeoOptions) => {
  const route = useRoute();
  const config = useRuntimeConfig();
const noIndex = Boolean(config.public.noIndex);
  const siteUrl = computed(() =>
    String(config.public.siteUrl).replace(/\/$/, ""),
  );
  const canonicalUrl = computed(() => siteUrl.value + route.path);
  const shareImage = computed(
    () => siteUrl.value + "/brand/social-preview.png",
  );

  useHead(() => ({
    title: title.value,
    script: noIndex ? [] : [
      {
        key: "static-page-schema:" + route.path,
        type: "application/ld+json",
        innerHTML: JSON.stringify({
          "@context": "https://schema.org",
          "@type": type,
          name: title.value,
          description: description.value,
          url: canonicalUrl.value,
          isPartOf: {
            "@id": siteUrl.value + "/#website",
          },
        }),
      },
      {
        key: "static-page-breadcrumb-schema:" + route.path,
        type: "application/ld+json",
        innerHTML: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: "ePlus OnAir",
              item: siteUrl.value + "/",
            },
            {
              "@type": "ListItem",
              position: 2,
              name: title.value,
              item: canonicalUrl.value,
            },
          ],
        }),
      },
    ],
  }));

  // Share cards are public on staging while robots noindex remains global.
  useSeoMeta(() => ({
    description: description.value,
    ogTitle: title.value,
    ogDescription: description.value,
    ogUrl: canonicalUrl.value,
    ogImage: shareImage.value,
    ogImageAlt: "ePlus OnAir — Live radio from around the world",
    ogImageWidth: 1200,
    ogImageHeight: 630,
    ogImageType: "image/png",
    twitterCard: "summary_large_image",
    twitterTitle: title.value,
    twitterDescription: description.value,
    twitterImage: shareImage.value,
    twitterImageAlt: "ePlus OnAir — Live radio from around the world",
  }));

  return { canonicalUrl };
};
