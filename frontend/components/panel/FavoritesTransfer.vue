<template>
  <section class="flex flex-wrap items-center gap-2" :aria-label="$t('transfer.title')">
    <UButton color="neutral" variant="outline" icon="i-lucide-download" class="min-h-11" :disabled="!listening.library.favorites.length" @click="download">{{ $t('transfer.export') }}</UButton>
    <UButton color="neutral" variant="outline" icon="i-lucide-upload" class="min-h-11" @click="importOpen = true">{{ $t('transfer.import') }}</UButton>
    <p v-if="exportError" role="alert" class="w-full text-sm text-rose-700 dark:text-rose-300">{{ $t('transfer.export_error') }}</p>
    <PanelFavoritesImport v-if="importOpen" @close="importOpen = false" />
  </section>
</template>
<script setup lang="ts">
import { useListeningStore } from '~/stores/listening';
import { exportFavorites } from '~/utils/favorites-transfer.mjs';
const listening = useListeningStore();
listening.hydrate();
const importOpen = ref(false);
const exportError = ref(false);
const download = () => {
  let url = '';
  try {
    url = URL.createObjectURL(new Blob([exportFavorites(listening.library.favorites)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'eplus-onair-favorites-v1.json';
    document.body.append(link);
    link.click();
    link.remove();
    exportError.value = false;
  } catch { exportError.value = true; }
  finally { if (url) setTimeout(() => URL.revokeObjectURL(url), 1000); }
};
</script>
