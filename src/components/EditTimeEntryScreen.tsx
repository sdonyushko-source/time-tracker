import { useState } from "react";
import { confirm } from "@tauri-apps/plugin-dialog";
import { Task, TimeEntry } from "../db";
import { formatTime } from "../utils";
import { updateEntry, deleteEntry } from "../entryOps";

interface EditTimeEntryScreenProps {
  entries: TimeEntry[];
  tasks: Task[];
  onClose: () => void;
}

type SessionEdit = {
  id: string;
  taskId: string;
  dateValue: string;    // YYYY-MM-DD for <input type="date">
  startDisplay: string; // HH:MM
  endDisplay: string;   // HH:MM
  durationSeconds: number;
};

function isoToDateValue(iso: string): string {
  const d = new Date(iso);
  return (
    d.getFullYear() + "-" +
    String(d.getMonth() + 1).padStart(2, "0") + "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

function isoToTimeDisplay(iso: string): string {
  const d = new Date(iso);
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}

// dateValue: YYYY-MM-DD, timeDisplay: HH:MM or partial
function displayToISO(dateValue: string, timeDisplay: string): string {
  const [yyyy, mm, dd] = dateValue.split("-");
  const [hh, min] = timeDisplay.split(":");
  return new Date(
    parseInt(yyyy), parseInt(mm) - 1, parseInt(dd),
    parseInt(hh ?? "0"), parseInt(min ?? "0")
  ).toISOString();
}

// YYYY-MM-DD → DD.MM.YYYY for display
function formatDateDisplay(dateValue: string): string {
  if (!dateValue) return "";
  const [yyyy, mm, dd] = dateValue.split("-");
  return `${dd}.${mm}.${yyyy}`;
}

// Parse free-text time input → "HH:MM", clamp hours ≤23, minutes ≤59
function parseTimeInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (!digits) return "00:00";
  const hStr = digits.length === 1 ? "0" + digits[0] : digits.slice(0, 2);
  const mStr = digits.length <= 2 ? "00" : digits.length === 3 ? digits[2] + "0" : digits.slice(2, 4);
  const h = Math.min(23, parseInt(hStr) || 0);
  const m = Math.min(59, parseInt(mStr) || 0);
  return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
}

// Compute duration in seconds from two HH:MM display values; 0 if invalid.
// If end <= start, assumes midnight crossing and adds 24h to end.
function computeSessionSeconds(dateValue: string, start: string, end: string): number {
  if (!dateValue || start.length < 5 || end.length < 5) return 0;
  try {
    const startMs = new Date(displayToISO(dateValue, start)).getTime();
    let endMs = new Date(displayToISO(dateValue, end)).getTime();
    if (endMs <= startMs) endMs += 86400 * 1000;
    return Math.round((endMs - startMs) / 1000);
  } catch {
    return 0;
  }
}


const TrashIcon = ({ color }: { color: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M18 9.5L17.3448 16.3792C17.181 18.0994 17.0991 18.9595 16.5269 19.4797C15.9548 20 15.0908 20 13.3629 20H10.6371C8.90921 20 8.04524 20 7.47307 19.4797C6.9009 18.9595 6.81899 18.0994 6.65517 16.3792L6 9.5M5 7H9M19 7H15M15 7C15 6.06812 15 5.60218 14.8478 5.23463C14.6448 4.74458 14.2554 4.35523 13.7654 4.15224C13.3978 4 12.9319 4 12 4C11.0681 4 10.6022 4 10.2346 4.15224C9.74458 4.35523 9.35523 4.74458 9.15224 5.23463C9 5.60218 9 6.06812 9 7M15 7L9 7" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

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

export default function EditTimeEntryScreen({ entries, tasks, onClose }: EditTimeEntryScreenProps) {
  const [sessions, setSessions] = useState<SessionEdit[]>(() =>
    entries.map((e) => ({
      id: e.id,
      taskId: e.taskId,
      dateValue: isoToDateValue(e.startTime),
      startDisplay: isoToTimeDisplay(e.startTime),
      endDisplay: e.endTime ? isoToTimeDisplay(e.endTime) : "00:00",
      durationSeconds: e.durationSeconds ?? 0,
    }))
  );

  const isMultiple = sessions.length > 1;

  const updateSession = (index: number, patch: Partial<SessionEdit>) => {
    setSessions((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const handleDeleteSession = async (index: number) => {
    const ok = await confirm("Are you sure you want to delete this time entry?", { title: "Delete time entry", kind: "warning" });
    if (!ok) return;
    await deleteEntry(sessions[index].id);
    const next = sessions.filter((_, i) => i !== index);
    if (next.length === 0) { onClose(); return; }
    setSessions(next);
  };

  const handleDeleteAll = async () => {
    const ok = await confirm("Are you sure you want to delete this time entry?", { title: "Delete time entry", kind: "warning" });
    if (!ok) return;
    for (const s of sessions) await deleteEntry(s.id);
    onClose();
  };

  const handleSave = async () => {
    for (const session of sessions) {
      const startISO = displayToISO(session.dateValue, session.startDisplay);
      const startMs = new Date(startISO).getTime();
      let endMs = new Date(displayToISO(session.dateValue, session.endDisplay)).getTime();
      if (endMs <= startMs) endMs += 86400 * 1000; // crosses midnight — shift end to next day
      const endISO = new Date(endMs).toISOString();
      const dur = Math.round((endMs - startMs) / 1000);
      const task = tasks.find((t) => t.id === session.taskId);
      await updateEntry(session.id, session.taskId, task?.name ?? "", startISO, endISO, dur);
    }
    onClose();
  };

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

  const cardStyle: React.CSSProperties = {
    marginTop: 12,
    background: "#F6F6F6",
    borderRadius: 12,
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  };

  return (
    <div style={{ width: 440, minHeight: 380, background: "white", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 24 }}>

        {/* Header */}
        <div style={{ width: 392, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: 20, color: "#181A2C" }}>
            Edit time entry
          </span>
          <button onClick={onClose} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6L18 18" stroke="#181A2C" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Session cards */}
        {sessions.map((session, i) => (
          <div key={session.id} style={cardStyle}>

            {/* Session header — only for multiple entries */}
            {isMultiple && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: 16, color: "#181A2C", lineHeight: "24px" }}>
                  Session {i + 1}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: 16, color: "#181A2C", width: 90, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
                    {formatTime(computeSessionSeconds(session.dateValue, session.startDisplay, session.endDisplay))}
                  </span>
                  <button
                    onClick={() => handleDeleteSession(i)}
                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center" }}
                  >
                    <TrashIcon color="#181A2C" />
                  </button>
                </div>
              </div>
            )}

            {/* Task dropdown */}
            <div style={{ ...fieldBase, position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px" }}>
              <span style={{
                flex: 1,
                minWidth: 0,
                fontSize: 16,
                color: "#181A2C",
                fontFamily: "'Inter', sans-serif",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                paddingRight: 12,
                pointerEvents: "none",
              }}>
                {tasks.find((t) => t.id === session.taskId)?.name ?? ""}
              </span>
              <div style={{ flexShrink: 0, pointerEvents: "none" }}>
                <ChevronDown />
              </div>
              <select
                value={session.taskId}
                onChange={(e) => updateSession(i, { taskId: e.target.value })}
                style={{
                  position: "absolute",
                  inset: 0,
                  opacity: 0,
                  cursor: "pointer",
                  width: "100%",
                  height: "100%",
                  fontSize: 16,
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            {/* Date + start — end */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {/* Date — custom visual + native picker overlay */}
              <div style={{ flex: 1, position: "relative" }}>
                <div style={{ ...fieldBase, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", pointerEvents: "none" }}>
                  <span style={{ fontSize: 16, color: "#181A2C", fontFamily: "'Inter', sans-serif" }}>
                    {formatDateDisplay(session.dateValue)}
                  </span>
                  <CalendarIcon />
                </div>
                <input
                  type="date"
                  value={session.dateValue}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => updateSession(i, { dateValue: e.target.value })}
                  style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }}
                />
              </div>
              {/* Start — separator — End */}
              <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 0 }}>
                <input
                  type="text"
                  value={session.startDisplay}
                  onChange={(e) => {
                    const d = e.target.value.replace(/\D/g, "").slice(0, 4);
                    updateSession(i, { startDisplay: d.length > 2 ? d.slice(0, 2) + ":" + d.slice(2) : d });
                  }}
                  onClick={(e) => e.currentTarget.select()}
                  onBlur={() => updateSession(i, { startDisplay: parseTimeInput(session.startDisplay) })}
                  onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                  style={{ ...fieldBase, width: 88, minWidth: 0, padding: "0 12px", textAlign: "center" }}
                />
                <div style={{ width: 8, height: 1, backgroundColor: "#C7C9CD", flexShrink: 0, marginLeft: 4, marginRight: 4 }} />
                <input
                  type="text"
                  value={session.endDisplay}
                  onChange={(e) => {
                    const d = e.target.value.replace(/\D/g, "").slice(0, 4);
                    updateSession(i, { endDisplay: d.length > 2 ? d.slice(0, 2) + ":" + d.slice(2) : d });
                  }}
                  onClick={(e) => e.currentTarget.select()}
                  onBlur={() => updateSession(i, { endDisplay: parseTimeInput(session.endDisplay) })}
                  onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                  style={{ ...fieldBase, width: 88, minWidth: 0, padding: "0 12px", textAlign: "center" }}
                />
              </div>
            </div>

          </div>
        ))}

        {/* Bottom buttons */}
        <div style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={handleDeleteAll}
            style={{ width: 48, height: 48, background: "#F6F6F6", borderRadius: 8, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
          >
            <TrashIcon color="#FF5429" />
          </button>
          <div style={{ flex: 1 }} />
          <button
            onClick={onClose}
            style={{ width: 96, height: 48, background: "#F6F6F6", borderRadius: 8, border: "none", fontSize: 16, fontFamily: "'Inter', sans-serif", color: "#181A2C", cursor: "pointer" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{ width: 96, height: 48, background: "linear-gradient(168deg, #8FD75F 15.3%, #31D877 85.2%)", boxShadow: "0px 4px 10px rgba(33,152,81,0.3)", borderRadius: 8, border: "none", fontSize: 16, fontFamily: "'Inter', sans-serif", color: "white", cursor: "pointer" }}
          >
            Save
          </button>
        </div>

      </div>
    </div>
  );
}
