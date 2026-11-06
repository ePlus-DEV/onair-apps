<template>
  <div class="min-w-0">
    <UButton color="neutral" variant="soft" icon="i-lucide-share-2" class="min-h-11 rounded-full" :disabled="!url || busy" @click="share">{{ $t('sharing.share') }}</UButton>
    <p v-if="message" role="status" class="mt-2 text-xs text-[var(--radio-text-muted)]">{{ message }}</p>
    <div v-if="manual" class="mt-2">
      <label class="text-xs text-[var(--radio-text-muted)]">{{ $t('sharing.manual') }}
        <input :value="url" readonly type="text" class="mt-1 min-h-11 w-full rounded-lg border border-[var(--radio-border)] bg-[var(--radio-surface-soft)] px-3 text-base text-[var(--radio-text)]" @focus="($event.target as HTMLInputElement).select()" />
      </label>
    </div>
  </div>
</template>
<script setup lang="ts">
import { shareStation, stationShareUrl } from '~/utils/station-sharing.mjs';
const props = defineProps<{ path: string; title: string }>();
const { t } = useI18n();
const url = computed(() => stationShareUrl(props.path));
const message = ref('');
const manual = ref(false);
const busy = ref(false);
watch(url, () => { message.value = ''; manual.value = false; });
const share = async () => {
  const target = url.value;
  busy.value = true;
  try {
    const result = await shareStation({ url: target, title: props.title }, navigator);
    if (url.value !== target) return;
    manual.value = result === 'manual';
    message.value = result === 'copied' ? t('sharing.copied') : '';
  } finally { busy.value = false; }
};
</script>
