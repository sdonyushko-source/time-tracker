import { useState } from "react";
import { TimeEntry, Settings } from "../db";
import { formatTime, formatTimeRU } from "../utils";

interface MainContentProps {
  last7Entries: TimeEntry[];
  settings: Settings;
  activeTaskId: string;
  activeEntryId: string | null;
  elapsedSeconds: number;
  isActive: boolean;
  onTaskClick: (taskId: string, date: string) => void;
  onTaskStart: (taskId: string) => void;
}

const PlayIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
    <defs>
      <linearGradient id="mcpg" x1="2" y1="2" x2="12" y2="24" gradientUnits="userSpaceOnUse">
        <stop stopColor="#8FD75F" /><stop offset="1" stopColor="#31D877" />
      </linearGradient>
    </defs>
    <circle cx="12" cy="12" r="12" fill="url(#mcpg)" />
    <path d="M8.5 11.443C8.5 9.038 8.5 7.836 9.276 7.408C10.052 6.980 11.069 7.622 13.102 8.906L13.984 9.464C15.789 10.603 16.691 11.173 16.691 12C16.691 12.827 15.789 13.397 13.984 14.536L13.102 15.094C11.069 16.378 10.052 17.020 9.276 16.592C8.5 16.164 8.5 14.962 8.5 12.557V11.443Z" fill="white" />
  </svg>
);

function getLocalDate(): string {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function getYesterdayDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function formatDateLabel(date: string, today: string, yesterday: string): string {
  if (date === today) return "Today";
  if (date === yesterday) return "Yesterday";
  const d = new Date(date + "T12:00:00");
  return d.getDate() + " " + d.toLocaleString("en-US", { month: "long" });
}

export default function MainContent({ last7Entries, settings, activeTaskId, activeEntryId, elapsedSeconds, isActive, onTaskClick, onTaskStart }: MainContentProps) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const today = getLocalDate();
  const yesterday = getYesterdayDate();
  const { dailyGoalSeconds } = settings;

  const dateMap: Record<string, TimeEntry[]> = {};
  last7Entries.forEach((e) => {
    if (!e.endTime) return;
    if (!dateMap[e.date]) dateMap[e.date] = [];
    dateMap[e.date].push(e);
  });

  const allDates = [...new Set([today, ...Object.keys(dateMap)])].sort((a, b) => b.localeCompare(a));

  return (
    <div>
      {allDates.map((date, dayIdx) => {
        const isToday = date === today;
        const dayEntries = dateMap[date] ?? [];

        const taskMap: Record<string, { name: string; totalSeconds: number; count: number; firstStartTime: string }> = {};
        dayEntries.forEach((e) => {
          if (!taskMap[e.taskId]) {
            taskMap[e.taskId] = { name: e.taskNameSnapshot, totalSeconds: 0, count: 0, firstStartTime: e.startTime };
          } else if (e.startTime < taskMap[e.taskId].firstStartTime) {
            taskMap[e.taskId].firstStartTime = e.startTime;
          }
          taskMap[e.taskId].count += 1;
          taskMap[e.taskId].totalSeconds += e.durationSeconds ?? 0;
        });

        if (isToday && isActive && activeTaskId) {
          const activeEntry = last7Entries.find((e) => e.id === activeEntryId);
          if (taskMap[activeTaskId]) {
            taskMap[activeTaskId].totalSeconds += elapsedSeconds;
          } else {
            taskMap[activeTaskId] = {
              name: activeEntry?.taskNameSnapshot ?? "",
              totalSeconds: elapsedSeconds,
              count: 0,
              firstStartTime: activeEntry?.startTime ?? new Date().toISOString(),
            };
          }
        }

        const tasks = Object.entries(taskMap)
          .map(([id, t]) => ({ id, ...t }))
          .sort((a, b) => a.firstStartTime.localeCompare(b.firstStartTime));

        const completedSeconds = dayEntries.reduce((s, e) => s + (e.durationSeconds ?? 0), 0);
        const totalSeconds = completedSeconds + (isToday && isActive ? elapsedSeconds : 0);
        const pct = dailyGoalSeconds > 0 ? Math.min(100, Math.round((totalSeconds / dailyGoalSeconds) * 100)) : 0;
        const pastColor = "#949599";

        return (
          <div key={date}>
            {dayIdx > 0 && <div style={{ height: 1, background: "#E3E5EA", margin: "4px 0" }} />}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0 8px" }}>
              <span style={{ fontSize: 16, fontWeight: 500, color: isToday ? "#181A2C" : pastColor, lineHeight: "24px" }}>
                {formatDateLabel(date, today, yesterday)}
              </span>
              {isToday ? (
                <span style={{ fontSize: 16, color: "#181A2C", lineHeight: "24px", fontVariantNumeric: "tabular-nums", fontFamily: "'Inter', sans-serif" }}>
                  {formatTimeRU(totalSeconds)} / {formatTimeRU(dailyGoalSeconds)} · {pct}%
                </span>
              ) : (
                <span style={{ fontSize: 16, color: pastColor, lineHeight: "24px", fontVariantNumeric: "tabular-nums", fontFamily: "'Inter', sans-serif" }}>
                  {formatTimeRU(totalSeconds)}
                </span>
              )}
            </div>
            {isToday && (
              <div style={{ height: 8, borderRadius: 40, background: "#F6F6F6", overflow: "hidden", marginBottom: 8 }}>
                <div style={{ height: 8, width: `${pct}%`, background: "linear-gradient(176deg, #8FD75F 24.6%, #31D877 69.3%)", boxShadow: "0px 4px 20px 0px rgba(33,152,81,0.3)" }} />
              </div>
            )}
            {tasks.length === 0 && isToday && (
              <div style={{ padding: "4px 0 8px", color: pastColor, fontSize: 15, lineHeight: "24px" }}>No tasks today</div>
            )}
            {tasks.map((task) => {
              const isTaskActive = task.id === activeTaskId && isActive && isToday;
              const hoverKey = `${date}-${task.id}`;
              const isHovered = hoveredKey === hoverKey;
              return (
                <div key={task.id} onClick={() => onTaskClick(task.id, date)} onMouseEnter={() => setHoveredKey(hoverKey)} onMouseLeave={() => setHoveredKey(null)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 40, padding: "0 8px", borderRadius: 8, background: isHovered ? "#F6F6F6" : "transparent", cursor: "pointer", margin: "0 -8px", boxSizing: "border-box" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1, minWidth: 0, overflow: "hidden" }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 15, color: isToday ? "#181A2C" : pastColor, lineHeight: "24px", flexShrink: 1 }}>{task.name}</span>
                    {isTaskActive && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#34C759", flexShrink: 0 }} />}
                    {task.count > 1 && <span style={{ padding: "0 4px", background: isHovered ? "white" : "#F6F6F6", borderRadius: 4, fontSize: 12, fontWeight: 500, color: "#908F8F", flexShrink: 0, textAlign: "center", lineHeight: "16px" }}>{task.count}</span>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    {isHovered && !isTaskActive && (
                      <button onClick={(e) => { e.stopPropagation(); onTaskStart(task.id); }} style={{ width: 24, height: 24, background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <PlayIcon />
                      </button>
                    )}
                    <span style={{ width: 72, flexShrink: 0, textAlign: "right", fontSize: 15, color: isToday ? "#181A2C" : pastColor, lineHeight: "24px", fontFamily: "'Inter', sans-serif", fontVariantNumeric: "tabular-nums" }}>
                      {formatTime(task.totalSeconds)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
