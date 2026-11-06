<template>
  <button
    type="button"
    class="flex items-center justify-center rounded-full fixed bottom-4 right-4 z-50 h-14 min-h-14 w-14 border border-[var(--radio-border)] bg-[var(--radio-text)] text-[var(--radio-page-bg)] shadow-xl shadow-slate-950/15 hover:opacity-90"
    aria-haspopup="dialog"
    aria-expanded="false"
    data-state="closed"
  >
    <span class="sr-only">{{ $t('chat.open') }}</span>
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="h-6 w-6"
      aria-hidden="true"
    >
      <path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"></path>
    </svg>
  </button>

  <section
    class="radio-themed-elevated fixed bottom-24 right-4 z-50 hidden h-[min(634px,calc(100vh-7rem))] w-[min(440px,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border border-[var(--radio-border)] shadow-2xl shadow-slate-950/20"
    :aria-label="$t('chat.title')"
  >
    <header class="border-b border-[var(--radio-border)] px-5 py-4">
      <h2 class="text-lg font-semibold tracking-tight text-[var(--radio-text)]">
        {{ $t('chat.title') }}
      </h2>
      <p class="mt-1 text-sm text-[var(--radio-text-muted)]">
        {{ $t('chat.powered_by') }}
      </p>
    </header>

    <div class="radio-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-4">
      <div class="flex gap-3 py-3 text-sm text-[var(--radio-text-muted)]">
        <span class="radio-themed-soft flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--radio-border)]">
          <svg viewBox="0 0 24 24" class="h-4 w-4 fill-current" aria-hidden="true">
            <path d="M9.8 15.9 9 18.8l-.8-2.9a4.5 4.5 0 0 0-3.1-3.1L2.3 12l2.8-.8a4.5 4.5 0 0 0 3.1-3.1L9 5.3l.8 2.8a4.5 4.5 0 0 0 3.1 3.1l2.9.8-2.9.8a4.5 4.5 0 0 0-3.1 3.1Z"></path>
          </svg>
        </span>
        <p class="leading-6">
          <span class="block font-semibold text-[var(--radio-text)]">AI</span>
          {{ $t('chat.greeting') }}
        </p>
      </div>
    </div>

    <form class="flex gap-2 border-t border-[var(--radio-border)] p-4">
      <input
        class="h-10 min-h-10 min-w-0 flex-1 rounded-xl border-[var(--radio-border)] bg-[var(--radio-surface-soft)] text-sm text-[var(--radio-text)] shadow-none placeholder:text-[var(--radio-text-muted)] focus:border-rose-300 focus:outline-none"
        :placeholder="$t('chat.placeholder')"
      />
      <button
        type="submit"
        class="inline-flex items-center justify-center h-10 min-h-10 rounded-xl border-0 bg-rose-500 px-4 text-white shadow-none hover:bg-rose-600"
      >
        {{ $t('chat.send') }}
      </button>
    </form>
  </section>
</template>
