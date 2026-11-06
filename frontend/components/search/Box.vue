<template>
  <div
    class="radio-search-box flex flex-col"
    :class="inline
      ? 'relative overflow-visible'
      : 'max-h-[calc(100dvh-2rem)] overflow-hidden radio-themed-surface rounded-3xl border border-[var(--radio-border)]'"
    @focusin="openResults"
    @focusout="onFocusout"
  >
    <div :class="inline ? 'p-0' : 'border-b border-[var(--radio-border)] p-4 sm:p-5'">
      <div class="flex items-center gap-3">
        <div class="relative min-w-0 flex-1">
          <fa
            :icon="['fas', 'magnifying-glass']"
            class="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--radio-text-muted)]"
          />
          <UInput
            ref="inputEl"
            id="search-input"
            v-model="input"
            type="search"
            :aria-label="$t('popup.search.text')"
            class="w-full"
            :ui="{ base: inline ? 'radio-search-panel-input h-11 rounded-2xl pl-11 pr-10 text-sm' : 'h-12 rounded-2xl pl-11 pr-4 text-base sm:text-sm' }"
            :placeholder="$t('popup.search.text')"
            @keydown.esc="closeResults"
          />
          <kbd v-if="inline && !input" class="pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 text-xs text-[var(--radio-text-muted)] sm:block">/</kbd>
        </div>
        <button
          v-if="!inline"
          type="button"
          class="inline-flex items-center justify-center h-10 min-h-10 w-10 shrink-0 rounded-xl border-0 text-[var(--radio-text-muted)] shadow-none hover:bg-[var(--radio-surface-soft)] hover:text-[var(--radio-text)]"
          :aria-label="$t('button.close')"
          @click="$emit('close')"
        >
          <fa :icon="['fas', 'xmark']" />
        </button>
      </div>

      <p v-if="!inline && usingLocal && localLoading" class="mt-3 text-xs leading-5 text-[var(--radio-text-muted)]" role="status">
        {{ $t('search.loading') }}
      </p>
      <p v-else-if="!inline && usingLocal && localError" class="mt-3 text-xs leading-5 text-[var(--radio-text-muted)]" role="status">
        {{ $t('search.unavailable') }}
      </p>
    </div>

    <div
      v-show="!inline || resultsOpen"
      class="radio-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4"
      :class="inline
        ? 'radio-search-popover absolute left-0 top-[calc(100%+0.5rem)] z-50 w-[min(36rem,calc(100vw-2rem))] max-h-[min(76dvh,38rem)] rounded-3xl border'
        : ''"
    >
      <!-- Inline header search must never grow taller while its index loads.
           Status feedback stays inside the results popover, shown only on focus. -->
      <p v-if="inline && usingLocal && localLoading" class="px-2 pb-3 text-xs leading-5 text-[var(--radio-text-muted)]" role="status">
        {{ $t('search.loading') }}
      </p>
      <p v-else-if="inline && usingLocal && localError" class="px-2 pb-3 text-xs leading-5 text-[var(--radio-text-muted)]" role="status">
        {{ $t('search.unavailable') }}
      </p>
      <div v-if="!input" class="space-y-5">
        <div v-if="searchHistory.length">
          <div class="mb-2 flex items-center justify-between px-2">
            <span class="text-sm font-bold text-[var(--radio-text)]">{{ $t("search.recent") }}</span>
            <button type="button" class="text-xs font-semibold text-rose-700 hover:text-rose-600 dark:text-rose-300 dark:hover:text-rose-200" @click="clearHistory">
              {{ $t("search.clear") }}
            </button>
          </div>
          <button
            v-for="item in searchHistory"
            :key="`history-${item}`"
            type="button"
            class="radio-search-panel-row flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition"
            @click="selectSuggestion(item)"
          >
            <UIcon name="i-lucide-clock-3" class="h-4 w-4 shrink-0 text-[var(--radio-text-muted)]" />
            <span dir="auto" class="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--radio-text)]">
              {{ item }}
            </span>
          </button>
        </div>

        <div>
          <div class="mb-2 flex items-center justify-between px-2">
            <span class="text-sm font-bold text-[var(--radio-text)]">{{ $t("search.suggestions") }}</span>
          </div>
          <button
            v-for="item in suggestionQueries"
            :key="`suggestion-${item}`"
            type="button"
            class="radio-search-panel-row flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition"
            @click="selectSuggestion(item)"
          >
            <UIcon name="i-lucide-trending-up" class="h-4 w-4 shrink-0 text-rose-700 dark:text-rose-300" />
            <span dir="auto" class="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--radio-text)]">
              {{ item }}
            </span>
          </button>
        </div>

        <div class="border-t border-[var(--radio-border)] pt-4">
          <div class="mb-2 flex items-center justify-between px-2">
            <span class="text-sm font-bold text-[var(--radio-text)]">{{ $t("popup.search.popular_channels") }}</span>
            <span class="text-xs text-[var(--radio-text-muted)]">{{ popularHits.length }}</span>
          </div>
          <SearchResult :result="popularHits" @select="handleSelect" />
        </div>
      </div>

      <div v-else>
        <div class="mb-2 flex items-center justify-between px-2">
          <span class="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--radio-text-muted)]">
            {{ input ? $t("popup.search.text") : $t("popup.search.popular_channels") }}
          </span>
          <span
            v-if="displayHits.length"
            class="text-xs tabular-nums text-[var(--radio-text-muted)]"
          >
            {{ displayHits.length }}
          </span>
        </div>
        <SearchResult :result="displayHits" @select="handleSelect" />
        <p v-if="!localLoading && !localError && !displayHits.length"
          class="px-3 py-8 text-center text-sm text-[var(--radio-text-muted)]" role="status">
          {{ $t('panel.no_channels') }}
        </p>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { searchLocalStations } from "~/utils/station-search.mjs";

const props = withDefaults(defineProps<{
  inline?: boolean;
  autofocus?: boolean;
}>(), {
  inline: false,
  autofocus: true,
});

const emit = defineEmits<{
  (event: "close"): void;
}>();

const config = useRuntimeConfig();
const algoliaConfigured = computed(() => Boolean(config.public.algoliaConfigured));
const { search } = useAlgoliaSearch(
  config.public.algoliaIndexStation,
);

const input = ref("");
const inputEl = useTemplateRef("inputEl");
const { index: localIndex, loading: localLoading, error: localError, load: loadLocalIndex } = useStationSearchIndex();
const remoteHits = shallowRef<unknown[]>([]);
const remoteQuery = ref("");
const algoliaFailed = ref(false);
const resultsOpen = ref(false);
const inline = computed(() => props.inline);
const usingLocal = computed(() => !algoliaConfigured.value || algoliaFailed.value || remoteQuery.value !== input.value || !input.value.trim());
const displayHits = computed(() =>
  usingLocal.value ? searchLocalStations(localIndex.value, input.value) : remoteHits.value
);
const suggestionQueries = [
  "VOV Giao Thông",
  "Heart UK",
  "Power 98 Love Songs",
  "Rap Việt",
  "EDM",
  "Acoustic",
];
const popularHits = computed(() =>
  resultsOpen.value || !inline.value ? searchLocalStations(localIndex.value, "", 5) : []
);
const searchHistory = ref<string[]>([]);
const HISTORY_KEY = "radio:search-history";
let typingTimeout: ReturnType<typeof setTimeout> | null = null;
let focusTimeout: ReturnType<typeof setTimeout> | null = null;
let generation = 0;

watch(input, (value: string) => {
  const version = ++generation;
  if (typingTimeout) clearTimeout(typingTimeout);
  if (!algoliaConfigured.value || algoliaFailed.value || !value.trim()) return;
  typingTimeout = setTimeout(async () => {
    try {
      const response = await search({ query: value, requestOptions: { hitsPerPage: 20 } });
      if (version !== generation) return;
      remoteHits.value = response.hits;
      remoteQuery.value = value;
    } catch {
      if (version === generation) algoliaFailed.value = true;
    }
  }, 250);
});

const openResults = (): void => {
  resultsOpen.value = true;
  void loadLocalIndex();
};

const closeResults = (): void => {
  resultsOpen.value = false;
  inputEl.value?.inputRef?.blur();
};

const focus = (): void => {
  openResults();
  inputEl.value?.inputRef?.focus();
};

const selectSuggestion = (value: string): void => {
  input.value = value;
  rememberSearch(value);
  focus();
};

const onFocusout = (event: FocusEvent): void => {
  if (!props.inline) return;
  const nextTarget = event.relatedTarget as Node | null;
  if (nextTarget && event.currentTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
  resultsOpen.value = false;
};

const handleSelect = (value?: string): void => {
  const selected = String(value || input.value).trim();
  if (selected) rememberSearch(selected);
  resultsOpen.value = false;
  emit("close");
};

const rememberSearch = (value: string): void => {
  const term = value.trim();
  if (!term || !import.meta.client) return;
  searchHistory.value = [term, ...searchHistory.value.filter(item => item.toLowerCase() !== term.toLowerCase())].slice(0, 6);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(searchHistory.value));
};

const clearHistory = (): void => {
  searchHistory.value = [];
  if (import.meta.client) localStorage.removeItem(HISTORY_KEY);
};

onMounted(() => {
  try {
    const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    if (Array.isArray(saved)) searchHistory.value = saved.filter(item => typeof item === "string" && item.trim()).slice(0, 6);
  } catch {
    searchHistory.value = [];
  }
  if (props.autofocus) focusTimeout = setTimeout(() => focus(), 50);
});

onBeforeUnmount(() => {
  generation += 1;
  if (typingTimeout) clearTimeout(typingTimeout);
  if (focusTimeout) clearTimeout(focusTimeout);
});

defineExpose({ focus });
</script>
