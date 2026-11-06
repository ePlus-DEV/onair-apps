<template>
  <section class="flex flex-wrap items-center gap-2" :aria-label="$t('transfer.title')">
    <UButton color="neutral" variant="outline" icon="i-lucide-download" class="min-h-11" :disabled="!listening.library.favorites.length || exporting" @click="download">{{ $t('transfer.export') }}</UButton>
    <UButton color="neutral" variant="outline" icon="i-lucide-upload" class="min-h-11" @click="importOpen = true">{{ $t('transfer.import') }}</UButton>
    <p v-if="exportError" role="alert" class="w-full text-sm text-rose-700 dark:text-rose-300">{{ $t('transfer.export_error') }}</p>
    <PanelFavoritesImport v-if="importOpen" @close="importOpen = false" />
  </section>
</template>
<script setup lang="ts">
import { useListeningStore } from '~/stores/listening';
import { exportFavorites } from '~/utils/favorites-transfer.mjs';
import { registerPlugin } from '@capacitor/core';
import { isAndroidApp } from '~/utils/native-radio';
const RadioFiles = registerPlugin<{ saveFavorites(options: { content: string }): Promise<{ saved: boolean }> }>('RadioFiles');
const listening = useListeningStore();
listening.hydrate();
const importOpen = ref(false);
const exportError = ref(false);
const exporting = ref(false);
const download = async () => {
  let url = '';
  exporting.value = true;
  try {
    const content = exportFavorites(listening.library.favorites);
    if (isAndroidApp()) {
      await RadioFiles.saveFavorites({ content });
      exportError.value = false;
      return;
    }
    url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'eplus-onair-favorites-v1.json';
    document.body.append(link);
    link.click();
    link.remove();
    exportError.value = false;
  } catch { exportError.value = true; }
  finally { exporting.value = false; if (url) setTimeout(() => URL.revokeObjectURL(url), 1000); }
};
</script>
