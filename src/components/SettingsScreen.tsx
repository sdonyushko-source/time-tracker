import { useState } from "react";
import { Settings, saveSettings } from "../db";

interface SettingsScreenProps {
  settings: Settings;
  onSave: (s: Settings) => void;
}

const CURRENCIES = ["USD", "EUR", "GBP", "UAH"];

const label: React.CSSProperties = {
  fontSize: 14,
  color: "#908F8F",
  fontFamily: "'Inter', sans-serif",
  marginBottom: 4,
  display: "block",
};

const input: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #E3E5EA",
  borderRadius: 8,
  fontSize: 16,
  fontFamily: "'Inter', sans-serif",
  color: "#181A2C",
  outline: "none",
  background: "#FFFFFF",
  boxSizing: "border-box",
};

export default function SettingsScreen({ settings, onSave }: SettingsScreenProps) {
  const [rate, setRate] = useState(String(settings.hourlyRate));
  const [currency, setCurrency] = useState(settings.currency);
  const [dailyHours, setDailyHours] = useState(
    String(Math.round((settings.dailyGoalSeconds / 3600) * 10) / 10)
  );
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    const s: Settings = {
      hourlyRate: parseFloat(rate) || 0,
      currency,
      dailyGoalSeconds: Math.round((parseFloat(dailyHours) || 8) * 3600),
    };
    await saveSettings(s);
    onSave(s);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div style={{ padding: "0 24px", display: "flex", flexDirection: "column", gap: 16 }}>
      <span style={{ fontSize: 16, fontWeight: 500, color: "#181A2C", fontFamily: "'Inter', sans-serif" }}>
        Settings
      </span>

      <div>
        <label style={label}>Hourly rate</label>
        <input
          type="number"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          style={input}
          min="0"
          step="0.5"
        />
      </div>

      <div>
        <label style={label}>Currency</label>
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          style={{ ...input, appearance: "none", cursor: "pointer" }}
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div>
        <label style={label}>Daily goal (hours)</label>
        <input
          type="number"
          value={dailyHours}
          onChange={(e) => setDailyHours(e.target.value)}
          style={input}
          min="0"
          max="24"
          step="0.5"
        />
      </div>

      <button
        onClick={handleSave}
        style={{
          padding: "10px 0",
          background: saved
            ? "#F6F6F6"
            : "linear-gradient(176deg, #8FD75F 24.6%, #31D877 69.3%)",
          border: "none",
          borderRadius: 8,
          fontSize: 16,
          fontFamily: "'Inter', sans-serif",
          color: saved ? "#908F8F" : "#FFFFFF",
          cursor: "pointer",
          fontWeight: 500,
          transition: "background 0.2s ease",
        }}
      >
        {saved ? "Saved" : "Save"}
      </button>
    </div>
  );
}
