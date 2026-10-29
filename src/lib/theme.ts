const themes = ["light", "dark"] as const;

export type Theme = (typeof themes)[number];

const THEME_KEY = "theme";

function isTheme(value: unknown): value is Theme {
  return themes.some((theme) => theme === value);
}

export function currentTheme(): Theme {
  const value = document.documentElement.dataset.theme;

  return isTheme(value) ? value : "light";
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}

export function storeTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    return;
  }
}
