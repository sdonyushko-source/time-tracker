import { useState } from "react";
import { TimeEntry, Settings } from "../db";
import { formatTime, formatTimeRU } from "../utils";

interface TodayProps {
  entries: TimeEntry[];
  settings: Settings;
  dailyGoalSeconds: number;
  activeTaskId?: string;
  onTaskClick?: (taskId: string) => void;
  onTaskStart?: (taskId: string) => void;
}

const PlayIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
    <defs>
      <linearGradient id="tpg" x1="2" y1="2" x2="12" y2="24" gradientUnits="userSpaceOnUse">
        <stop stopColor="#8FD75F"/>
        <stop offset="1" stopColor="#31D877"/>
      </linearGradient>
    </defs>
    <circle cx="12" cy="12" r="12" fill="url(#tpg)"/>
    <path d="M8.5 11.443C8.5 9.038 8.5 7.836 9.276 7.408C10.052 6.980 11.069 7.622 13.102 8.906L13.984 9.464C15.789 10.603 16.691 11.173 16.691 12C16.691 12.827 15.789 13.397 13.984 14.536L13.102 15.094C11.069 16.378 10.052 17.020 9.276 16.592C8.5 16.164 8.5 14.962 8.5 12.557V11.443Z" fill="white"/>
  </svg>
);

export default function Today({ entries, settings: _settings, dailyGoalSeconds, activeTaskId, onTaskClick, onTaskStart }: TodayProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const totalSeconds = entries.reduce((s, e) => s + (e.durationSeconds ?? 0), 0);
  const pct = dailyGoalSeconds > 0 ? Math.min(100, Math.round((totalSeconds / dailyGoalSeconds) * 100)) : 0;

  const taskMap: Record<string, { name: string; totalSeconds: number; count: number; firstStartTime: string }> = {};
  entries.forEach((e) => {
    if (!e.endTime) return;
    if (!taskMap[e.taskId]) {
      taskMap[e.taskId] = { name: e.taskNameSnapshot, totalSeconds: 0, count: 0, firstStartTime: e.startTime };
    } else if (e.startTime < taskMap[e.taskId].firstStartTime) {
      taskMap[e.taskId].firstStartTime = e.startTime;
    }
    taskMap[e.taskId].count += 1;
    taskMap[e.taskId].totalSeconds += e.durationSeconds ?? 0;
  });
  const tasks = Object.entries(taskMap)
    .map(([id, t]) => ({ id, ...t }))
    .sort((a, b) => a.firstStartTime.localeCompare(b.firstStartTime));

  return (
    <>
    <style>{`.today-task-list::-webkit-scrollbar { display: none; }`}</style>
    <div style={{
      border: "1px solid #E3E5EA",
      borderRadius: 12,
      paddingTop: 16,
      paddingLeft: 8,
      paddingRight: 8,
      paddingBottom: 0,
      display: "flex",
      flexDirection: "column",
      gap: 16,
      width: 392,
    }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 12px", width: 376 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 16, fontWeight: 500, color: "#181A2C", lineHeight: "24px" }}>Today</span>
          <span style={{ fontSize: 16, color: "#181A2C", lineHeight: "24px", fontFamily: "'Inter', sans-serif", fontVariantNumeric: "tabular-nums" }}>
            {formatTimeRU(totalSeconds)} / {formatTimeRU(dailyGoalSeconds)} · {pct}%
          </span>
        </div>
        <div style={{ height: 12, borderRadius: 40, background: "#F6F6F6", overflow: "hidden", width: "100%" }}>
          <div style={{ height: 12, width: `${pct}%`, background: "linear-gradient(176deg, #8FD75F 24.6%, #31D877 69.3%)", boxShadow: "0px 4px 20px 0px rgba(33,152,81,0.3)" }} />
        </div>
      </div>

      <div className="today-task-list" style={{ display: "flex", flexDirection: "column", width: "100%", maxHeight: "calc(4 * 40px + 8px)", overflowY: "auto", scrollbarWidth: "none", borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }}>
        {tasks.map((task, i) => {
          const isHovered = hoveredId === task.id;
          const isActive = task.id === activeTaskId;
          return (
            <div
              key={task.id}
              onClick={() => onTaskClick?.(task.id)}
              onMouseEnter={() => setHoveredId(task.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                height: 40,
                padding: "0 12px",
                borderRadius: 8,
                background: isHovered ? "#F6F6F6" : "white",
                width: 376,
                flexShrink: 0,
                boxSizing: "border-box",
                cursor: onTaskClick ? "pointer" : "default",
                marginBottom: i === tasks.length - 1 ? 8 : 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1, minWidth: 0, overflow: "hidden" }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 16, color: "#181A2C", lineHeight: "24px", flexShrink: 1 }}>
                  {task.name}
                </span>
                {isActive && (
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#34C759", flexShrink: 0 }} />
                )}
                {task.count > 1 && (
                  <span style={{ width: 16, background: isHovered ? "white" : "#F6F6F6", borderRadius: 4, fontSize: 12, fontWeight: 500, color: "#908F8F", flexShrink: 0, textAlign: "center", lineHeight: "16px" }}>
                    {task.count}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                {isHovered && !isActive && onTaskStart && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onTaskStart(task.id); }}
                    style={{ width: 24, height: 24, background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                  >
                    <PlayIcon />
                  </button>
                )}
                <span style={{ width: 72, flexShrink: 0, textAlign: "right", fontSize: 16, color: "#181A2C", lineHeight: "24px", fontFamily: "'Inter', sans-serif", fontVariantNumeric: "tabular-nums" }}>
                  {formatTime(task.totalSeconds)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
    </>
  );
}
