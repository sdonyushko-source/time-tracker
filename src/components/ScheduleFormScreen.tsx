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
  const [durationH, setDurationH] = useState(String(Math.floor((schedule?.durationMinutes ?? 60) / 60)).padStart(2, "0"));
  const [durationM, setDurationM] = useState(String((schedule?.durationMinutes ?? 60) % 60).padStart(2, "0"));
  const [autoStart, setAutoStart] = useState(!!schedule?.autoStart);

  useEffect(() => {
    (async () => {
      const t = await getTasks();
      setTasks(t);
      if (!taskId && t.length) setTaskId(t[0].id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Task select (48px) and Auto-start select (48px) share this recipe —
  // same as TaskManagerScreen's inputBase.
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

  // Duration (32px) matches SettingsScreen's Daily goal recipe exactly.
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
    const durationMinutes = (parseInt(durationH, 10) || 0) * 60 + (parseInt(durationM, 10) || 0);
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

          {/* Start time */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ ...rowLabelStyle, color: colors.textPrimary }}>Start time</span>
            <TimeInput
              value={startTime}
              onChange={setStartTime}
              style={{ ...inputBase, width: 96, textAlign: "center", fontVariantNumeric: "tabular-nums" }}
            />
          </div>

          {/* Duration */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ ...rowLabelStyle, color: colors.textPrimary }}>Duration</span>
            <div style={{ ...compactInputStyle, width: 96, justifyContent: "center", gap: 4 }}>
              <input
                type="text"
                inputMode="numeric"
                maxLength={2}
                value={durationH}
                onChange={(e) => setDurationH(e.target.value.replace(/\D/g, "").slice(0, 2))}
                onBlur={() => setDurationH((h) => h.padStart(2, "0"))}
                style={{ width: 20, border: "none", background: "transparent", textAlign: "center", fontFamily: "'Inter', sans-serif", fontSize: 16, color: colors.textPrimary, outline: "none", padding: 0 }}
              />
              <span style={{ color: colors.textPrimary, fontSize: 16, fontFamily: "'Inter', sans-serif" }}>:</span>
              <input
                type="text"
                inputMode="numeric"
                maxLength={2}
                value={durationM}
                onChange={(e) => setDurationM(e.target.value.replace(/\D/g, "").slice(0, 2))}
                onBlur={() => setDurationM((m) => m.padStart(2, "0"))}
                style={{ width: 20, border: "none", background: "transparent", textAlign: "center", fontFamily: "'Inter', sans-serif", fontSize: 16, color: colors.textPrimary, outline: "none", padding: 0 }}
              />
            </div>
          </div>

          {/* Auto-start */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ ...rowLabelStyle, color: colors.textPrimary }}>Auto-start</span>
            <div style={{ ...selectWrapStyle, width: 96 }}>
              <span style={{ flex: 1, minWidth: 0 }}>{autoStart ? "On" : "Off"}</span>
              <ChevronDown color={colors.textPrimary} />
              <select
                value={autoStart ? "on" : "off"}
                onChange={(e) => setAutoStart(e.target.value === "on")}
                style={nativeSelectStyle}
              >
                <option value="off">Off</option>
                <option value="on">On</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <ButtonBar cancelLabel="Cancel" saveLabel="Save" onCancel={onClose} onSave={handleSave} />
    </div>
  );
}
