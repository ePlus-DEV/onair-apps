<template>
  <UDropdownMenu v-model:open="open" :items="items" :content="{ align: 'end' }" :modal="false">
    <UButton color="neutral" variant="ghost" :icon="icon" class="h-11 w-11 justify-center" :aria-label="$t('text.darkmode.' + $colorMode.preference)" />
  </UDropdownMenu>
</template>

<script setup lang="ts">
const colorMode = useColorMode();
const { t } = useI18n();
const route = useRoute();
const open = ref(false);
const options = [
  { value: 'light', icon: 'i-lucide-sun' },
  { value: 'dark', icon: 'i-lucide-moon' },
  { value: 'system', icon: 'i-lucide-monitor' },
];
const icon = computed(() => options.find(option => option.value === colorMode.preference)?.icon || 'i-lucide-monitor');
const items = computed(() => options.map(option => ({
  label: t('text.darkmode.' + option.value), icon: option.icon,
  type: 'checkbox' as const,
  checked: colorMode.preference === option.value,
  onSelect: () => { open.value = false; colorMode.preference = option.value; },
})));
watch(() => route.fullPath, () => { open.value = false; });
</script>

