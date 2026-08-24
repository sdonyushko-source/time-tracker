export type ThemeMode = "light" | "dark";
export type ThemeSetting = "system" | ThemeMode;

export interface ThemeColors {
  pageBg: string;
  cardBg: string;
  inputBg: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  progressTrack: string;
  badgeBg: string;
  badgeText: string;
  menuShadow: string;
  footerBorder: string;
  menuBg: string;
  menuItemHover: string;
  cardRowHover: string;
}

const light: ThemeColors = {
  pageBg: "#FFFFFF",
  cardBg: "#F6F6F6",
  inputBg: "#FFFFFF",
  border: "#E3E5EA",
  textPrimary: "#181A2C",
  textSecondary: "#908F8F",
  progressTrack: "#EBEBEB",
  badgeBg: "#F6F6F6",
  badgeText: "#908F8F",
  menuShadow: "0px 8px 12px rgba(24,26,44,0.12)",
  footerBorder: "1px solid #E3E5EA",
  menuBg: "#FFFFFF",
  menuItemHover: "#F6F6F6",
  cardRowHover: "#FFFFFF",
};

const dark: ThemeColors = {
  pageBg: "#101010",
  cardBg: "#1A1A1B",
  inputBg: "#1A1A1B",
  border: "#2D2D2D",
  textPrimary: "#F3F4F6",
  textSecondary: "#949599",
  progressTrack: "#545454",
  badgeBg: "#626262",
  badgeText: "#F3F4F6",
  menuShadow: "0px 8px 12px rgba(0,0,0,0.5)",
  footerBorder: "none",
  menuBg: "#1A1A1B",
  menuItemHover: "#2D2D2D",
  // cardBg is already the darkest surface in dark mode, so its own hover
  // needs to go lighter (not match menuItemHover, which is meant to sit on
  // pageBg) to stay visible against the card it's nested in.
  cardRowHover: "#2D2D2D",
};

export function getColors(mode: ThemeMode): ThemeColors {
  return mode === "dark" ? dark : light;
}
