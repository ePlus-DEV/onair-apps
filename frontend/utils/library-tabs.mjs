// Keep the Library's selected section in the URL so direct links,
// reload and browser Back/Forward all resolve to the same visible panel.
export const LIBRARY_TAB_VALUES = Object.freeze(['favorites', 'recent', 'stats']);

export const libraryTabFromHash = hash => {
  const value = typeof hash === 'string' && hash.startsWith('#') ? hash.slice(1) : '';
  return LIBRARY_TAB_VALUES.includes(value) ? value : 'all';
};

export const libraryTabHref = value =>
  LIBRARY_TAB_VALUES.includes(value) ? `/library#${value}` : '/library';
