// Light / dark theme. public/index.html sets the starting theme before the page draws (no flash):
// the viewer's saved choice, otherwise their device setting.

const KEY = 'theme';
const THEME_COLORS = { dark: '#050505', light: '#f7f1e4' };

export const getTheme = () => (document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark');

const apply = (theme) => {
  document.documentElement.setAttribute('data-theme', theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLORS[theme]);
};

export const setTheme = (theme) => {
  apply(theme);
  try { localStorage.setItem(KEY, theme); } catch {}
};

const hasSavedChoice = () => {
  try { return ['light', 'dark'].includes(localStorage.getItem(KEY)); } catch { return false; }
};

// Follow the device setting while the viewer hasn't picked a theme themselves
export const watchSystemTheme = (onChange) => {
  if (!window.matchMedia) return () => {};
  const query = window.matchMedia('(prefers-color-scheme: light)');
  const handler = (e) => {
    if (hasSavedChoice()) return;
    const theme = e.matches ? 'light' : 'dark';
    apply(theme);
    onChange(theme);
  };
  query.addEventListener?.('change', handler);
  return () => query.removeEventListener?.('change', handler);
};
