<template>
  <div v-if="health" class="rounded-xl border border-[var(--radio-border)] bg-[var(--radio-surface-elevated)] p-3 text-sm text-[var(--radio-text)]">
    <p role="status" class="leading-5">{{ $t(`recovery.${health}`) }}</p>
    <div v-if="diagnostics?.sourceCount" class="mt-2 space-y-1 rounded-lg border border-[var(--radio-border)] bg-[var(--radio-surface-soft)] px-3 py-2 text-xs text-[var(--radio-text-muted)]">
      <p class="break-words">{{ $t('recovery.source_position', { index: diagnostics.sourceIndex, total: diagnostics.sourceCount }) }} · {{ diagnostics.sourceLabel }}</p>
      <p v-if="diagnostics.retryAttempt > 0" class="tabular-nums">{{ $t('recovery.attempt', { attempt: diagnostics.retryAttempt, limit: diagnostics.maxAttempts }) }}</p>
      <p v-if="diagnostics.failureReason" class="text-amber-700 dark:text-amber-300">{{ $t('recovery.reason_' + diagnostics.failureReason) }}</p>
      <p v-if="diagnostics.lastPlayedAt">{{ $t('recovery.last_played', { time: diagnostics.lastPlayedAt }) }}</p>
      <p class="text-[11px]">{{ $t('recovery.local_observation') }}</p>
    </div>
    <div v-if="health !== 'connecting'" class="mt-2 flex flex-wrap items-center gap-2">
      <UButton v-if="online && playable" color="neutral" variant="soft" class="min-h-11" @click="$emit('retry')">{{ $t('player.retry') }}</UButton>
      <UDropdownMenu v-if="online && sourceItems.length > 1" :items="sourceItems" :content="{ side: 'top', align: 'start' }" :ui="{ content: 'max-w-[calc(100vw-2rem)]' }">
        <UButton color="neutral" variant="outline" class="min-h-11">{{ $t('player.source') }}</UButton>
      </UDropdownMenu>
      <a v-if="reportUrl && online" :href="reportUrl" target="_blank" rel="noopener noreferrer" class="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-semibold text-rose-700 underline-offset-4 hover:underline dark:text-rose-300">{{ $t('recovery.report') }}</a>
    </div>
    <p v-if="health === 'exhausted' || health === 'unsupported'" class="mt-2 text-xs text-[var(--radio-text-muted)]">{{ $t('recovery.report_hint') }}</p>
  </div>
</template>
<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui';
interface RecoveryDiagnostics {
  sourceIndex: number;
  sourceCount: number;
  sourceLabel: string;
  retryAttempt: number;
  maxAttempts: number;
  failureReason: 'network' | 'decode' | 'timeout' | 'unknown' | '';
  lastPlayedAt: string;
}
defineProps<{ health: string; online: boolean; playable: boolean; sourceItems: DropdownMenuItem[]; reportUrl: string; diagnostics?: RecoveryDiagnostics }>();
defineEmits(['retry']);
</script>
