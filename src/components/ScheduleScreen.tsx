import { useState, useEffect } from "react";
import { confirm } from "@tauri-apps/plugin-dialog";
import { Schedule, getSchedules, deleteSchedule } from "../db";
import { formatTimeRU } from "../utils";
import { useTheme } from "../ThemeContext";
import TitleBarSpacer from "./TitleBarSpacer";
import ScheduleFormScreen from "./ScheduleFormScreen";

const ThreeDotsIcon = ({ color }: { color: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="5" r="1.5" fill={color}/>
    <circle cx="12" cy="12" r="1.5" fill={color}/>
    <circle cx="12" cy="19" r="1.5" fill={color}/>
  </svg>
);

const CloseIcon = ({ color }: { color: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M18 6L6 18M6 6L18 18" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

// Filled lightning bolt — autoStart on. Same green as the active-task dot
// elsewhere in the app (#34C759, theme-independent).
const LightningIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="M13 2L4 14H11L9 22L20 8H12L13 2Z" fill="#34C759"/>
  </svg>
);

// Outline bell — autoStart off (notify only).
const BellIcon = ({ color }: { color: string }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="M12 3C9.5 3 8 5 8 8V11L6 14V15H18V14L16 11V8C16 5 14.5 3 12 3Z" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M10 18C10 19.1046 10.8954 20 12 20C13.1046 20 14 19.1046 14 18" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const WEEKDAY_LABELS: { value: number; label: string }[] = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

// weekdays is stored as e.g. "1,2,3,4,5" (JS Date.getDay() convention) —
// this renders it back in Mon..Sun display order regardless of storage order.
function formatWeekdays(weekdays: string): string {
  const set = new Set(weekdays.split(",").map(Number));
  return WEEKDAY_LABELS.filter((d) => set.has(d.value)).map((d) => d.label).join(", ");
}

interface ScheduleScreenProps {
  onClose: () => void;
}

export default function ScheduleScreen({ onClose }: ScheduleScreenProps) {
  const { colors } = useTheme();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [mode, setMode] = useState<"list" | "form">("list");
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const refresh = () => { getSchedules().then(setSchedules); };

  useEffect(() => { refresh(); }, []);

  const handleAdd = () => { setEditingSchedule(null); setMode("form"); };
  const handleEdit = (s: Schedule) => { setOpenMenuId(null); setEditingSchedule(s); setMode("form"); };

  const handleDelete = async (id: string) => {
    setOpenMenuId(null);
    const ok = await confirm("Are you sure you want to delete this rule?", { title: "Delete rule", kind: "warning" });
    if (!ok) return;
    await deleteSchedule(id);
    setSchedules((prev) => prev.filter((s) => s.id !== id));
  };

  const handleFormClose = () => {
    setMode("list");
    setEditingSchedule(null);
    refresh();
  };

  if (mode === "form") {
    return <ScheduleFormScreen schedule={editingSchedule} onClose={handleFormClose} />;
  }

  return (
    <div style={{
      width: 440,
      height: "100vh",
      background: colors.pageBg,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      boxSizing: "border-box",
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
          Schedule
        </span>
        <button onClick={onClose} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center" }}>
          <CloseIcon color={colors.textPrimary} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "12px 24px 24px" }}>
        <div style={{
          background: colors.cardBg,
          borderRadius: 12,
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}>
          {/* Header row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: 16, color: colors.textPrimary, lineHeight: "24px" }}>
              Recurring
            </span>
            <span
              onClick={handleAdd}
              style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: 16, color: "#7381D3", lineHeight: "24px", cursor: "pointer" }}
            >
              Add
            </span>
          </div>

          {schedules.length === 0 && (
            <div style={{ padding: "6px 0", color: colors.textSecondary, fontSize: 15, lineHeight: "24px" }}>
              No recurring rules yet
            </div>
          )}

          {/* Rule list */}
          {schedules.map((s) => (
            <div
              key={s.id}
              onMouseEnter={() => setHoveredId(s.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "4px 0", position: "relative" }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                  <span style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 16,
                    color: colors.textPrimary,
                    lineHeight: "24px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    minWidth: 0,
                  }}>
                    {s.taskNameSnapshot}
                  </span>
                  {s.autoStart ? <LightningIcon /> : <BellIcon color={colors.textSecondary} />}
                </div>
                <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: colors.textSecondary, lineHeight: "18px" }}>
                  {formatWeekdays(s.weekdays)} · {s.startTime} · {formatTimeRU(s.durationMinutes * 60)}
                </span>
              </div>
              <button
                onClick={() => setOpenMenuId(openMenuId === s.id ? null : s.id)}
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", flexShrink: 0, opacity: hoveredId === s.id || openMenuId === s.id ? 1 : 0, transition: "opacity 0.3s ease" }}
              >
                <ThreeDotsIcon color={colors.textPrimary} />
              </button>
              {openMenuId === s.id && (
                <>
                  <div
                    onClick={() => setOpenMenuId(null)}
                    style={{ position: "fixed", inset: 0, zIndex: 98 }}
                  />
                  <div style={{
                    position: "absolute",
                    top: 28,
                    right: 0,
                    background: colors.menuBg,
                    borderRadius: 8,
                    padding: 8,
                    boxShadow: colors.menuShadow,
                    zIndex: 99,
                    display: "flex",
                    flexDirection: "column",
                    minWidth: 120,
                  }}>
                    <div
                      onClick={() => handleEdit(s)}
                      style={{ padding: "8px 12px", borderRadius: 6, cursor: "pointer", fontFamily: "'Inter', sans-serif", fontSize: 14, color: colors.textPrimary, transition: "background 0.3s ease" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = colors.menuItemHover)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      Edit
                    </div>
                    <div
                      onClick={() => handleDelete(s.id)}
                      style={{ padding: "8px 12px", borderRadius: 6, cursor: "pointer", fontFamily: "'Inter', sans-serif", fontSize: 14, color: "#FF5429", transition: "background 0.3s ease" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = colors.menuItemHover)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      Delete
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
