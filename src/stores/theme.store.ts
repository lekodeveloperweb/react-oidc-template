import { atom } from "jotai";
import { getDefaultStore } from "jotai/vanilla";
import { useAtom } from "jotai/react";

const STORAGE_KEY = "theme";

function getInitialTheme(): "light" | "dark" {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  if (window.matchMedia?.("(prefers-color-scheme: dark)").matches)
    return "dark";
  return "light";
}

export const themeAtom = atom<"light" | "dark">(getInitialTheme());

export function setTheme(theme: "light" | "dark"): void {
  localStorage.setItem(STORAGE_KEY, theme);
  const store = getDefaultStore();
  store.set(themeAtom, theme);
}

export function toggleTheme(): void {
  const store = getDefaultStore();
  const current = store.get(themeAtom);
  setTheme(current === "dark" ? "light" : "dark");
}

export function applyTheme(theme: "light" | "dark"): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function useTheme() {
  const [theme, setThemeAtom] = useAtom(themeAtom);

  const toggleThemeFn = () => {
    setThemeAtom(theme === "dark" ? "light" : "dark");
  };

  return { theme, setTheme, toggleTheme: toggleThemeFn };
}
