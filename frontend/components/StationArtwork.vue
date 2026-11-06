<template>
  <img :src="resolvedSrc" :alt="alt" :class="''" decoding="async" :loading="eager ? 'eager' : 'lazy'" @error="failed = true" />
</template>
<script setup lang="ts">
const props = defineProps<{ src?: string; alt: string; eager?: boolean }>();
const failed = ref(false);
watch(() => props.src, () => { failed.value = false; });
const siteAssetUrl = useSiteAssetUrl();
const resolvedSrc = computed(() => siteAssetUrl(failed.value || !props.src ? '/brand/logo-share.png' : props.src));
</script>
