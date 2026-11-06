<template>
  <UModal v-model:open="open" :title="$t('transfer.title')" :description="$t('transfer.description')" :ui="{ content: 'max-w-lg', body: 'space-y-4' }" @after:leave="$emit('close')">
    <template #body>
      <p class="text-sm text-[var(--radio-text-muted)]">{{ $t('transfer.limit') }}</p>
      <label class="block text-sm font-semibold">{{ $t('transfer.choose') }}
        <input type="file" accept=".json,application/json" class="mt-2 block min-h-11 w-full text-base" :disabled="reading" @change="readFile" />
      </label>
      <p v-if="loading" role="status">{{ $t('search.loading') }}</p>
      <p v-else-if="error" role="alert">{{ $t('search.unavailable') }}</p>
      <p v-if="invalid" role="alert" class="text-sm text-rose-700 dark:text-rose-300">{{ $t('transfer.invalid') }}</p>
      <template v-if="preview">
        <p role="status" class="text-sm leading-6">{{ $t('transfer.preview', { add: preview.additions.length, duplicate: preview.duplicates, missing: preview.missing, overflow: preview.overflow }) }}</p>
        <ul class="max-h-48 space-y-2 overflow-y-auto rounded-xl bg-[var(--radio-surface-soft)] p-3">
          <li v-for="station in preview.additions" :key="station.url" dir="auto" class="break-words text-sm">{{ station.title }}</li>
        </ul>
      </template>
      <p v-if="done" role="status" class="text-sm">{{ $t('transfer.done', { count: importedCount }) }}</p>
    </template>
    <template #footer>
      <div class="flex w-full flex-wrap justify-end gap-2">
        <UButton color="neutral" variant="outline" class="min-h-11" @click="open = false">{{ $t('button.close') }}</UButton>
        <UButton class="min-h-11" :disabled="!preview?.additions.length || reading" @click="confirm">{{ $t('transfer.confirm') }}</UButton>
      </div>
    </template>
  </UModal>
</template>
<script setup lang="ts">
import { useListeningStore } from '~/stores/listening';
import { FAVORITES_FILE_LIMIT, parseFavoritesFile, previewFavoritesImport } from '~/utils/favorites-transfer.mjs';
defineEmits(['close']);
const open = ref(true);
const listening = useListeningStore();
const { index, loading, error } = useStationSearchIndex();
const urls = ref<string[] | null>(null);
const invalid = ref(false);
const reading = ref(false);
const done = ref(false);
const importedCount = ref(0);
const preview = computed(() => urls.value && !loading.value && !error.value
  ? previewFavoritesImport(urls.value, index.value, listening.library.favorites) : null);
let generation = 0;
onBeforeUnmount(() => { generation += 1; });
const readFile = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  const request = ++generation;
  urls.value = null;
  invalid.value = false;
  done.value = false;
  if (!file) return;
  reading.value = true;
  try {
    if (file.size > FAVORITES_FILE_LIMIT) throw new Error('File too large');
    const parsed = parseFavoritesFile(await file.text());
    if (request === generation) urls.value = parsed;
  } catch { if (request === generation) invalid.value = true; }
  finally { if (request === generation) reading.value = false; }
};
const confirm = () => {
  if (!preview.value) return;
  importedCount.value = preview.value.additions.length;
  listening.mergeFavorites(preview.value.additions);
  urls.value = null;
  done.value = true;
};
</script>
