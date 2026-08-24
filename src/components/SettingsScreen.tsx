import { useState, useEffect } from "react";
import { Settings, getSettings, saveSettings } from "../db";
import { useTheme } from "../ThemeContext";
import ButtonBar from "./ButtonBar";
import TitleBarSpacer from "./TitleBarSpacer";

const ChevronDown = ({ color }: { color: string }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M4 6L8 10L12 6" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const InfoIcon = ({ color }: { color: string }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="6.5" stroke={color} strokeWidth="1.2"/>
    <rect x="7.3" y="6.8" width="1.4" height="4.2" rx="0.7" fill={color}/>
    <rect x="7.3" y="4.6" width="1.4" height="1.4" rx="0.7" fill={color}/>
  </svg>
);

const CloseIcon = ({ color }: { color: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M18 6L6 18M6 6L18 18" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

interface SettingsScreenProps {
  onClose: () => void;
}

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  width: "100%",
};

const nativeSelectStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  opacity: 0,
  cursor: "pointer",
  border: "none",
};

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      style={{
        width: 64,
        height: 28,
        borderRadius: 100,
        border: "none",
        padding: 2,
        background: on ? "#34C759" : "rgba(60,60,67,0.3)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: on ? "flex-end" : "flex-start",
        flexShrink: 0,
        transition: "background 0.15s ease",
      }}
    >
      <div style={{ width: 39, height: 24, borderRadius: 100, background: "white", boxShadow: "0px 1px 3px rgba(0,0,0,0.25)", flexShrink: 0 }} />
    </button>
  );
}

export default function SettingsScreen({ onClose }: SettingsScreenProps) {
  const { colors, setThemeSetting } = useTheme();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [hourlyRate, setHourlyRate] = useState("30");
  const [commission, setCommission] = useState("0");
  const [goalH, setGoalH] = useState("06");
  const [goalM, setGoalM] = useState("00");
  const [goalMoney, setGoalMoney] = useState("0");

  useEffect(() => {
    (async () => {
      const s = await getSettings();
      setSettings(s);
      setHourlyRate(String(s.hourlyRate));
      setCommission(String(s.commission));
      setGoalH(String(Math.floor(s.dailyGoalSeconds / 3600)).padStart(2, "0"));
      setGoalM(String(Math.floor((s.dailyGoalSeconds % 3600) / 60)).padStart(2, "0"));
      setGoalMoney(String(s.dailyGoalMoney));
    })();
  }, []);

  const persist = async (next: Settings) => {
    setSettings(next);
    setThemeSetting(next.theme);
    await saveSettings(next);
  };

  if (!settings) return null;

  const labelStyle: React.CSSProperties = {
    fontFamily: "'Inter', sans-serif",
    fontSize: 16,
    fontWeight: 400,
    color: colors.textPrimary,
    lineHeight: "24px",
  };

  const inputStyle: React.CSSProperties = {
    height: 32,
    background: colors.inputBg,
    border: `1px solid ${colors.border}`,
    borderRadius: 8,
    padding: "0 16px",
    fontSize: 16,
    color: colors.textPrimary,
    fontFamily: "'Inter', sans-serif",
    outline: "none",
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
  };

  const selectWrapStyle: React.CSSProperties = {
    ...inputStyle,
    width: 180,
    padding: "0 8px 0 16px",
    cursor: "pointer",
    position: "relative",
    justifyContent: "space-between",
    flexShrink: 0,
  };

  const divider = <div style={{ height: 1, background: colors.border, width: "100%", flexShrink: 0 }} />;

  return (
    <div style={{
      width: 440,
      height: "100vh",
      background: colors.pageBg,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      boxSizing: "border-box",
      position: "relative",
    }}>
      <TitleBarSpacer />
      {/* Heading */}
      <div style={{ flexShrink: 0, padding: "24px 24px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{
          fontFamily: "'Inter', sans-serif",
          fontWeight: 500,
          fontSize: 20,
          lineHeight: "24px",
          color: colors.textPrimary,
        }}>
          Settings
        </span>
        <button onClick={onClose} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center" }}>
          <CloseIcon color={colors.textPrimary} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "12px 24px 84px" }}>
        <div style={{
          background: colors.cardBg,
          borderRadius: 12,
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}>

          {/* Hourly rate */}
          <div style={rowStyle}>
            <span style={{ ...labelStyle, width: 159 }}>Hourly rate</span>
            <div style={{ ...inputStyle, width: 180, gap: 8, justifyContent: "space-between" }}>
              <input
                type="text"
                inputMode="decimal"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                onBlur={() => persist({ ...settings, hourlyRate: Number(hourlyRate) || 0 })}
                onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                style={{ flex: 1, minWidth: 0, border: "none", background: "none", fontSize: 16, color: colors.textPrimary, fontFamily: "'Inter', sans-serif", outline: "none" }}
              />
              <span style={{ fontSize: 16, color: colors.textSecondary, fontFamily: "'Inter', sans-serif" }}>$</span>
            </div>
          </div>

          {/* Commission */}
          <div style={rowStyle}>
            <span style={{ ...labelStyle, width: 159 }}>Commission</span>
            <div style={{ ...inputStyle, width: 180, gap: 8, justifyContent: "space-between" }}>
              <input
                type="text"
                inputMode="decimal"
                value={commission}
                onChange={(e) => setCommission(e.target.value)}
                onBlur={() => persist({ ...settings, commission: Number(commission) || 0 })}
                onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                style={{ flex: 1, minWidth: 0, border: "none", background: "none", fontSize: 16, color: colors.textPrimary, fontFamily: "'Inter', sans-serif", outline: "none" }}
              />
              <span style={{ fontSize: 16, color: colors.textSecondary, fontFamily: "'Inter', sans-serif" }}>%</span>
            </div>
          </div>

          {divider}

          {/* Daily goal */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
            <div style={rowStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={labelStyle}>Daily goal</span>
                <InfoIcon color={colors.textSecondary} />
              </div>
              <Toggle
                on={settings.dailyGoalEnabled}
                onToggle={() => persist({ ...settings, dailyGoalEnabled: !settings.dailyGoalEnabled })}
              />
            </div>

            {settings.dailyGoalEnabled && (
              <div style={{ display: "flex", gap: 8, width: "100%" }}>
                <div style={selectWrapStyle}>
                  <span style={{ flex: 1, minWidth: 0 }}>{settings.dailyGoalType === "money" ? "Money" : "Hours"}</span>
                  <ChevronDown color={colors.textPrimary} />
                  <select
                    value={settings.dailyGoalType}
                    onChange={(e) => persist({ ...settings, dailyGoalType: e.target.value as "hours" | "money" })}
                    style={nativeSelectStyle}
                  >
                    <option value="hours">Hours</option>
                    <option value="money">Money</option>
                  </select>
                </div>

                {settings.dailyGoalType === "hours" ? (
                  <div style={{ ...inputStyle, flex: 1, minWidth: 0, justifyContent: "center", gap: 4 }}>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={2}
                      value={goalH}
                      onChange={(e) => setGoalH(e.target.value.replace(/\D/g, "").slice(0, 2))}
                      onBlur={() => {
                        const h = goalH.padStart(2, "0");
                        setGoalH(h);
                        persist({ ...settings, dailyGoalSeconds: (parseInt(h) || 0) * 3600 + (parseInt(goalM) || 0) * 60 });
                      }}
                      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                      style={{ width: 20, border: "none", background: "transparent", textAlign: "center", fontFamily: "'Inter', sans-serif", fontSize: 16, color: colors.textPrimary, outline: "none", padding: 0 }}
                    />
                    <span style={{ color: colors.textPrimary, fontSize: 16, fontFamily: "'Inter', sans-serif" }}>:</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={2}
                      value={goalM}
                      onChange={(e) => setGoalM(e.target.value.replace(/\D/g, "").slice(0, 2))}
                      onBlur={() => {
                        const m = goalM.padStart(2, "0");
                        setGoalM(m);
                        persist({ ...settings, dailyGoalSeconds: (parseInt(goalH) || 0) * 3600 + (parseInt(m) || 0) * 60 });
                      }}
                      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                      style={{ width: 20, border: "none", background: "transparent", textAlign: "center", fontFamily: "'Inter', sans-serif", fontSize: 16, color: colors.textPrimary, outline: "none", padding: 0 }}
                    />
                  </div>
                ) : (
                  <div style={{ ...inputStyle, flex: 1, minWidth: 0, gap: 8, justifyContent: "space-between" }}>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={goalMoney}
                      onChange={(e) => setGoalMoney(e.target.value)}
                      onBlur={() => persist({ ...settings, dailyGoalMoney: Number(goalMoney) || 0 })}
                      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                      style={{ flex: 1, minWidth: 0, border: "none", background: "none", fontSize: 16, color: colors.textPrimary, fontFamily: "'Inter', sans-serif", outline: "none" }}
                    />
                    <span style={{ fontSize: 16, color: colors.textSecondary, fontFamily: "'Inter', sans-serif" }}>$</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {divider}

          {/* Round time in report */}
          <div style={rowStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={labelStyle}>Round time in report</span>
              <InfoIcon color={colors.textSecondary} />
            </div>
            <div style={selectWrapStyle}>
              <span style={{ flex: 1, minWidth: 0 }}>
                {settings.roundReportMinutes === 0 ? "Off" : `${settings.roundReportMinutes} minutes`}
              </span>
              <ChevronDown color={colors.textPrimary} />
              <select
                value={settings.roundReportMinutes}
                onChange={(e) => persist({ ...settings, roundReportMinutes: Number(e.target.value) })}
                style={nativeSelectStyle}
              >
                <option value={0}>Off</option>
                <option value={5}>5 minutes</option>
                <option value={10}>10 minutes</option>
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
              </select>
            </div>
          </div>

          {/* Theme */}
          <div style={rowStyle}>
            <span style={{ ...labelStyle, width: 175 }}>Theme</span>
            <div style={selectWrapStyle}>
              <span style={{ flex: 1, minWidth: 0 }}>
                {settings.theme === "light" ? "Light" : settings.theme === "dark" ? "Dark" : "System"}
              </span>
              <ChevronDown color={colors.textPrimary} />
              <select
                value={settings.theme}
                onChange={(e) => persist({ ...settings, theme: e.target.value as "system" | "light" | "dark" })}
                style={nativeSelectStyle}
              >
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
          </div>

        </div>

      </div>

      <ButtonBar onCancel={onClose} onSave={onClose} />
    </div>
  );
}
