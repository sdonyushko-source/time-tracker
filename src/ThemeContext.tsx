import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ThemeSetting, ThemeMode, ThemeColors, getColors } from "./theme";

interface ThemeContextValue {
  mode: ThemeMode;
  colors: ThemeColors;
  setThemeSetting: (setting: ThemeSetting) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: "light",
  colors: getColors("light"),
  setThemeSetting: () => {},
});

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

interface ThemeProviderProps {
  initialSetting: ThemeSetting;
  children: ReactNode;
}

export function ThemeProvider({ initialSetting, children }: ThemeProviderProps) {
  const [themeSetting, setThemeSettingState] = useState<ThemeSetting>(initialSetting);
  const [systemIsDark, setSystemIsDark] = useState(false);
  const [loadedInitial, setLoadedInitial] = useState(false);

  // Only adopt the setting coming from DB once it actually loads (App starts
  // with a "system" placeholder before getSettings() resolves) — after that,
  // live changes flow through setThemeSetting instead.
  useEffect(() => {
    if (!loadedInitial) {
      setThemeSettingState(initialSetting);
      setLoadedInitial(true);
    }
  }, [initialSetting, loadedInitial]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    (async () => {
      const win = getCurrentWindow();
      try {
        const t = await win.theme();
        setSystemIsDark(t === "dark");
      } catch {
        // ignore — falls back to light until/unless the event fires
      }
      try {
        unlisten = await win.onThemeChanged(({ payload }) => setSystemIsDark(payload === "dark"));
      } catch {
        // ignore
      }
    })();
    return () => unlisten?.();
  }, []);

  const mode: ThemeMode = themeSetting === "system" ? (systemIsDark ? "dark" : "light") : themeSetting;
  const colors = getColors(mode);

  useEffect(() => {
    getCurrentWindow().setTheme(themeSetting === "system" ? null : themeSetting).catch(() => {});
  }, [themeSetting]);

  useEffect(() => {
    document.body.style.background = colors.pageBg;
  }, [colors.pageBg]);

  return (
    <ThemeContext.Provider value={{ mode, colors, setThemeSetting: setThemeSettingState }}>
      {children}
    </ThemeContext.Provider>
  );
}
