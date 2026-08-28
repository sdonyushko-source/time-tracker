import { useState, useEffect } from "react";
import { Task, Schedule, getTasks, createSchedule, updateSchedule } from "../db";
import { useTheme } from "../ThemeContext";
import ButtonBar from "./ButtonBar";
import TitleBarSpacer from "./TitleBarSpacer";
import TimeInput from "./TimeInput";

const CloseIcon = ({ color }: { color: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M18 6L6 18M6 6L18 18" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const ChevronDown = ({ color }: { color: string }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M4 6L8 10L12 6" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// Same pill switch as SettingsScreen's Daily goal toggle.
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

// HH:MM + minutes → HH:MM, wrapping past midnight.
function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = (((h * 60 + m + minutes) % 1440) + 1440) % 1440;
  return String(Math.floor(total / 60)).padStart(2, "0") + ":" + String(total % 60).padStart(2, "0");
}

// Minutes between two HH:MM values — same "end <= start means it crosses
// midnight" convention as EditTimeEntryScreen's computeSessionSeconds.
function timeDiffMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let diff = eh * 60 + em - (sh * 60 + sm);
  if (diff <= 0) diff += 1440;
  return diff;
}

const WEEKDAY_LABELS: { value: number; label: string }[] = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

interface ScheduleFormScreenProps {
  schedule: Schedule | null;
  onClose: () => void;
}

const nativeSelectStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  opacity: 0,
  cursor: "pointer",
  border: "none",
};

const rowLabelStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontSize: 16,
  fontWeight: 400,
  lineHeight: "24px",
};

export default function ScheduleFormScreen({ schedule, onClose }: ScheduleFormScreenProps) {
  const { colors } = useTheme();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskId, setTaskId] = useState(schedule?.taskId ?? "");
  const [weekdays, setWeekdays] = useState<number[]>(schedule ? schedule.weekdays.split(",").map(Number) : []);
  const [startTime, setStartTime] = useState(schedule?.startTime ?? "09:00");
  const [endTime, setEndTime] = useState(
    schedule ? addMinutesToTime(schedule.startTime, schedule.durationMinutes) : "10:00"
  );
  const [autoStart, setAutoStart] = useState(!!schedule?.autoStart);

  useEffect(() => {
    (async () => {
      const t = await getTasks();
      setTasks(t);
      if (!taskId && t.length) setTaskId(t[0].id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Task select — same recipe as TaskManagerScreen's inputBase.
  const inputBase: React.CSSProperties = {
    height: 48,
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

  // Start/End time inputs (32px) — same fieldBase recipe EditTimeEntryScreen
  // uses for its Start–End row.
  const compactInputStyle: React.CSSProperties = {
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
    ...inputBase,
    width: "100%",
    padding: "0 12px 0 16px",
    cursor: "pointer",
    position: "relative",
    justifyContent: "space-between",
  };

  const toggleWeekday = (v: number) => {
    setWeekdays((prev) => (prev.includes(v) ? prev.filter((d) => d !== v) : [...prev, v]));
  };

  const canSave = !!taskId && weekdays.length > 0;

  const handleSave = async () => {
    if (!canSave) return;
    const task = tasks.find((t) => t.id === taskId);
    const weekdaysStr = [...weekdays].sort((a, b) => a - b).join(",");
    const durationMinutes = timeDiffMinutes(startTime, endTime);
    if (schedule) {
      await updateSchedule(schedule.id, taskId, task?.name ?? "", weekdaysStr, startTime, durationMinutes, autoStart);
    } else {
      await createSchedule(taskId, task?.name ?? "", weekdaysStr, startTime, durationMinutes, autoStart);
    }
    onClose();
  };

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
        <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: 20, lineHeight: "24px", color: colors.textPrimary }}>
          {schedule ? "Edit rule" : "New rule"}
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
          {/* Task */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ ...rowLabelStyle, color: colors.textPrimary }}>Task</span>
            <div style={selectWrapStyle}>
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {tasks.find((t) => t.id === taskId)?.name ?? "No tasks"}
              </span>
              <ChevronDown color={colors.textPrimary} />
              <select value={taskId} onChange={(e) => setTaskId(e.target.value)} style={nativeSelectStyle}>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Repeats on */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ ...rowLabelStyle, color: colors.textPrimary }}>Repeats on</span>
            <div style={{ display: "flex", gap: 6 }}>
              {WEEKDAY_LABELS.map((d) => {
                const active = weekdays.includes(d.value);
                return (
                  <div
                    key={d.value}
                    onClick={() => toggleWeekday(d.value)}
                    style={{
                      flex: 1,
                      height: 32,
                      borderRadius: 8,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 13,
                      fontFamily: "'Inter', sans-serif",
                      cursor: "pointer",
                      boxSizing: "border-box",
                      background: active ? "#7381D3" : colors.inputBg,
                      color: active ? "#FFFFFF" : colors.textPrimary,
                      border: `1px solid ${active ? "#7381D3" : colors.border}`,
                      transition: "background 0.2s ease, border-color 0.2s ease",
                    }}
                  >
                    {d.label}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Start / End time — label + inputs on one row (like Auto-start
              below), inputs using the same TimeInput + dash-separator recipe
              as EditTimeEntryScreen's Start–End row. */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ ...rowLabelStyle, color: colors.textPrimary }}>Start / End time</span>
            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 0, width: 180 }}>
              <TimeInput
                value={startTime}
                onChange={setStartTime}
                style={{ ...compactInputStyle, flex: 1, minWidth: 0, padding: "0 12px", textAlign: "center" }}
              />
              <div style={{ width: 8, height: 1, backgroundColor: colors.border, flexShrink: 0, marginLeft: 4, marginRight: 4 }} />
              <TimeInput
                value={endTime}
                onChange={setEndTime}
                style={{ ...compactInputStyle, flex: 1, minWidth: 0, padding: "0 12px", textAlign: "center" }}
              />
            </div>
          </div>

          {/* Auto-start — same pill toggle as Settings' Daily goal. */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ ...rowLabelStyle, color: colors.textPrimary }}>Auto-start</span>
            <Toggle on={autoStart} onToggle={() => setAutoStart((v) => !v)} />
          </div>
        </div>
      </div>

      <ButtonBar cancelLabel="Cancel" saveLabel="Save" onCancel={onClose} onSave={handleSave} />
    </div>
  );
}
