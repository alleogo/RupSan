// Light / dark theme. public/index.html sets the starting theme before the page draws (no flash):
// the viewer's saved choice, otherwise light.

const KEY = 'theme';
const THEME_COLORS = { dark: '#050505', light: '#efe4cf' };

export const getTheme = () => (document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');

export const setTheme = (theme) => {
  document.documentElement.setAttribute('data-theme', theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLORS[theme]);
  try { localStorage.setItem(KEY, theme); } catch {}
};
