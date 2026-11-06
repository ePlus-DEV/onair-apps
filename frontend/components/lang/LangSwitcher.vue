<template>
  <UDropdownMenu v-model:open="open" :items="items" :content="{ align: 'end' }" :modal="false" :ui="{ content: 'w-60 max-h-[min(24rem,calc(100dvh-6rem))] overflow-x-hidden overflow-y-auto' }">
    <UButton ref="trigger" color="neutral" variant="ghost" icon="i-lucide-languages" class="h-11 min-w-11" :aria-label="$t('navmenu.language')">
      <span class="hidden uppercase sm:inline">{{ locale.split('-')[0] }}</span>
    </UButton>
    <template #item-leading="{ item }">
      <span class="flex h-7 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--radio-surface-soft)] text-[10px] font-semibold uppercase">{{ item.code }}</span>
    </template>
  </UDropdownMenu>
</template>

<script setup lang="ts">
const { locale, locales, setLocale } = useI18n();
const dayjs = useDayjs();
const route = useRoute();
const open = ref(false);
const trigger = useTemplateRef('trigger');
const selectLocale = async (code: string) => {
  // Close before i18n rerenders. Reka owns outside-click, Escape and focus.
  open.value = false;
  await setLocale(code);
  await nextTick();
  trigger.value?.$el?.focus();
};
const items = computed(() => locales.value.map(item => ({
  label: item.name || item.code,
  code: item.code,
  type: 'checkbox' as const,
  checked: locale.value === item.code,
  onSelect: () => { void selectLocale(item.code); },
})));
watch(locale, value => dayjs.locale(value.toLowerCase()), { immediate: true });
watch(() => route.fullPath, () => { open.value = false; });
</script>

