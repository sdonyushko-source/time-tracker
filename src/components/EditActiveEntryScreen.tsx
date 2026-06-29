import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Task } from "../db";
import { updateActiveEntry } from "../entryOps";

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

function parseTimeInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (!digits) return "00:00";
  const hStr = digits.length === 1 ? "0" + digits[0] : digits.slice(0, 2);
  const mStr = digits.length <= 2 ? "00" : digits.length === 3 ? digits[2] + "0" : digits.slice(2, 4);
  const h = Math.min(23, parseInt(hStr) || 0);
  const m = Math.min(59, parseInt(mStr) || 0);
  return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
}

const CalendarIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M6.85714 5.57143H5.57143C4.15127 5.57143 3 6.7227 3 8.14286V18.4286C3 19.8487 4.15127 21 5.57143 21H18.4286C19.8487 21 21 19.8487 21 18.4286V8.14286C21 6.7227 19.8487 5.57143 18.4286 5.57143H17.1429M6.85714 5.57143V3M6.85714 5.57143V8.14286M6.85714 5.57143H17.1429M17.1429 5.57143V3M17.1429 5.57143V8.14286" stroke="#181A2C" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M7.5 12.6428H7.51286M12 12.6428H12.0129M16.5 12.6428H16.5129M7.5 16.5H7.51286M12 16.5H12.0129" stroke="#181A2C" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const ChevronDown = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M2 5L8 11L14 5" stroke="#181A2C" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export default function EditActiveEntryScreen({ entryId, taskId, startTime, tasks, onClose, onSave }: EditActiveEntryScreenProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [selectedTaskId, setSelectedTaskId] = useState(taskId);
  const [dateValue, setDateValue] = useState(isoToDateValue(startTime));
  const [startDisplay, setStartDisplay] = useState(isoToTimeDisplay(startTime));

  const fieldBase: React.CSSProperties = {
    height: 48,
    background: "white",
    border: "1px solid #E3E5EA",
    borderRadius: 8,
    fontSize: 16,
    color: "#181A2C",
    fontFamily: "'Inter', sans-serif",
    outline: "none",
    boxSizing: "border-box",
  };

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => {
      const h = Math.min(el.scrollHeight + 36, 640);
      invoke("resize_window", { width: 440, height: h });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleSave = async () => {
    const startISO = displayToISO(dateValue, startDisplay);
    const task = tasks.find((t) => t.id === selectedTaskId);
    await updateActiveEntry(entryId, selectedTaskId, task?.name ?? "", startISO);
    onSave(selectedTaskId, startISO);
  };

  return (
    <div ref={rootRef} style={{ width: 440, background: "white", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: 20, color: "#181A2C" }}>Edit active entry</span>
          <button onClick={onClose} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6L18 18" stroke="#181A2C" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        <div style={{ marginTop: 12, background: "#F6F6F6", borderRadius: 12, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ ...fieldBase, position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px" }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 16, color: "#181A2C", fontFamily: "'Inter', sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 12, pointerEvents: "none" }}>
              {tasks.find((t) => t.id === selectedTaskId)?.name ?? ""}
            </span>
            <div style={{ flexShrink: 0, pointerEvents: "none" }}><ChevronDown /></div>
            <select value={selectedTaskId} onChange={(e) => setSelectedTaskId(e.target.value)} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }}>
              {tasks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ flex: 1, position: "relative" }}>
              <div style={{ ...fieldBase, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", pointerEvents: "none" }}>
                <span style={{ fontSize: 16, color: "#181A2C", fontFamily: "'Inter', sans-serif" }}>{formatDateDisplay(dateValue)}</span>
                <CalendarIcon />
              </div>
              <input type="date" value={dateValue} max={new Date().toISOString().split("T")[0]} onChange={(e) => setDateValue(e.target.value)} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }} />
            </div>
            <input type="text" value={startDisplay}
              onChange={(e) => { const d = e.target.value.replace(/\D/g, "").slice(0, 4); setStartDisplay(d.length > 2 ? d.slice(0, 2) + ":" + d.slice(2) : d); }}
              onClick={(e) => e.currentTarget.select()}
              onBlur={() => setStartDisplay(parseTimeInput(startDisplay))}
              onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
              style={{ ...fieldBase, width: 88, minWidth: 0, padding: "0 12px", textAlign: "center" }}
            />
            <div style={{ width: 8, height: 1, backgroundColor: "#C7C9CD", flexShrink: 0 }} />
            <input type="text" value="--:--" disabled style={{ ...fieldBase, width: 88, minWidth: 0, padding: "0 12px", textAlign: "center", opacity: 0.5, cursor: "not-allowed" }} />
          </div>
        </div>
        <div style={{ marginTop: 24, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12 }}>
          <button onClick={onClose} style={{ width: 96, height: 48, background: "#F6F6F6", borderRadius: 8, border: "none", fontSize: 16, fontFamily: "'Inter', sans-serif", color: "#181A2C", cursor: "pointer" }}>Cancel</button>
          <button onClick={handleSave} style={{ width: 96, height: 48, background: "linear-gradient(168deg, #8FD75F 15.3%, #31D877 85.2%)", boxShadow: "0px 4px 10px rgba(33,152,81,0.3)", borderRadius: 8, border: "none", fontSize: 16, fontFamily: "'Inter', sans-serif", color: "white", cursor: "pointer" }}>Save</button>
        </div>
      </div>
    </div>
  );
}
