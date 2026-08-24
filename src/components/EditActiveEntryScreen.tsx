import { useState, useEffect } from "react";
import { Task } from "../db";
import { updateActiveEntry } from "../entryOps";
import { useTheme } from "../ThemeContext";
import ButtonBar from "./ButtonBar";
import TimeInput from "./TimeInput";
import TitleBarSpacer from "./TitleBarSpacer";

interface EditActiveEntryScreenProps {
  entryId: string;
  taskId: string;
  startTime: string;
  tasks: Task[];
  onClose: () => void;
  onSave: (newTaskId: string, newStartISO: string) => void;
}

function isoToDateValue(iso: string): string {
  const d = new Date(iso);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function isoToTimeDisplay(iso: string): string {
  const d = new Date(iso);
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}

function displayToISO(dateValue: string, timeDisplay: string): string {
  const [yyyy, mm, dd] = dateValue.split("-");
  const [hh, min] = timeDisplay.split(":");
  return new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd), parseInt(hh ?? "0"), parseInt(min ?? "0")).toISOString();
}

function formatDateDisplay(dateValue: string): string {
  if (!dateValue) return "";
  const [yyyy, mm, dd] = dateValue.split("-");
  return `${dd}.${mm}.${yyyy}`;
}

const CalendarIcon = ({ color }: { color: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M6.85714 5.57143H5.57143C4.15127 5.57143 3 6.7227 3 8.14286V18.4286C3 19.8487 4.15127 21 5.57143 21H18.4286C19.8487 21 21 19.8487 21 18.4286V8.14286C21 6.7227 19.8487 5.57143 18.4286 5.57143H17.1429M6.85714 5.57143V3M6.85714 5.57143V8.14286M6.85714 5.57143H17.1429M17.1429 5.57143V3M17.1429 5.57143V8.14286" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M7.5 12.6428H7.51286M12 12.6428H12.0129M16.5 12.6428H16.5129M7.5 16.5H7.51286M12 16.5H12.0129" stroke={color} strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const ChevronDown = ({ color }: { color: string }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M2 5L8 11L14 5" stroke={color} strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export default function EditActiveEntryScreen({ entryId, taskId, startTime, tasks, onClose, onSave }: EditActiveEntryScreenProps) {
  const { colors } = useTheme();
  const [selectedTaskId, setSelectedTaskId] = useState(taskId);
  const [dateValue, setDateValue] = useState(isoToDateValue(startTime));
  const [startDisplay, setStartDisplay] = useState(isoToTimeDisplay(startTime));

  const fieldBase: React.CSSProperties = {
    height: 32,
    background: colors.inputBg,
    border: `1px solid ${colors.border}`,
    borderRadius: 8,
    fontSize: 16,
    color: colors.textPrimary,
    fontFamily: "'Inter', sans-serif",
    outline: "none",
    boxSizing: "border-box",
  };

  const handleSave = async () => {
    const startISO = displayToISO(dateValue, startDisplay);
    const task = tasks.find((t) => t.id === selectedTaskId);
    await updateActiveEntry(entryId, selectedTaskId, task?.name ?? "", startISO);
    onSave(selectedTaskId, startISO);
  };

  // Window-level, not a div onKeyDown: bubbling-based handlers only fire
  // when focus is inside this screen's DOM subtree, so Enter pressed with
  // nothing focused (e.g. right after closing the date picker) was silently
  // swallowed.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") handleSave();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return (
    <div
      style={{ width: 440, height: "100vh", background: colors.pageBg, display: "flex", flexDirection: "column", overflow: "hidden", boxSizing: "border-box", position: "relative" }}
    >
      <TitleBarSpacer />
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", padding: "24px 24px 84px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: 20, color: colors.textPrimary }}>Edit active entry</span>
          <button onClick={onClose} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6L18 18" stroke={colors.textPrimary} strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        <div style={{ marginTop: 12, background: colors.cardBg, borderRadius: 12, padding: 8, display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ ...fieldBase, position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 8px 0 16px" }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 16, color: colors.textPrimary, fontFamily: "'Inter', sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 12, pointerEvents: "none" }}>
              {tasks.find((t) => t.id === selectedTaskId)?.name ?? ""}
            </span>
            <div style={{ flexShrink: 0, pointerEvents: "none" }}><ChevronDown color={colors.textPrimary} /></div>
            <select value={selectedTaskId} onChange={(e) => setSelectedTaskId(e.target.value)} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }}>
              {tasks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 186, flexShrink: 0, position: "relative" }}>
              <div style={{ ...fieldBase, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", pointerEvents: "none" }}>
                <span style={{ fontSize: 16, color: colors.textPrimary, fontFamily: "'Inter', sans-serif" }}>{formatDateDisplay(dateValue)}</span>
                <CalendarIcon color={colors.textPrimary} />
              </div>
              <input type="date" value={dateValue} max={new Date().toISOString().split("T")[0]} onChange={(e) => setDateValue(e.target.value)} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }} />
            </div>
            <div style={{ display: "flex", flex: 1, minWidth: 0, alignItems: "center", gap: 0 }}>
              <TimeInput
                value={startDisplay}
                onChange={setStartDisplay}
                style={{ ...fieldBase, flex: 1, minWidth: 0, padding: "0 12px", textAlign: "center" }}
              />
              <div style={{ width: 8, height: 1, backgroundColor: colors.border, flexShrink: 0, marginLeft: 4, marginRight: 4 }} />
              <input type="text" value="--:--" disabled style={{ ...fieldBase, flex: 1, minWidth: 0, padding: "0 12px", textAlign: "center", opacity: 0.5, cursor: "not-allowed" }} />
            </div>
          </div>
        </div>
      </div>

      <ButtonBar onCancel={onClose} onSave={handleSave} />
    </div>
  );
}
