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
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 44 44" fill="none">
    <defs>
      <filter id="tpf" x="0" y="0" width="44" height="44" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
        <feFlood floodOpacity="0" result="BackgroundImageFix"/>
        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
        <feOffset dy="2"/>
        <feGaussianBlur stdDeviation="5"/>
        <feComposite in2="hardAlpha" operator="out"/>
        <feColorMatrix type="matrix" values="0 0 0 0 0.131328 0 0 0 0 0.595196 0 0 0 0 0.316306 0 0 0 0.3 0"/>
        <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow"/>
        <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow" result="shape"/>
      </filter>
      <linearGradient id="tpg" x1="13.5" y1="11.75" x2="22" y2="32" gradientUnits="userSpaceOnUse">
        <stop stopColor="#8FD75F"/>
        <stop offset="1" stopColor="#31D877"/>
      </linearGradient>
    </defs>
    <g filter="url(#tpf)">
      <circle cx="22" cy="20" r="12" fill="url(#tpg)"/>
    </g>
    <path d="M18.5 19.443C18.5 17.038 18.5 15.8355 19.2759 15.4078C20.0519 14.9801 21.0686 15.6223 23.102 16.9065L23.9839 17.4635C25.7886 18.6033 26.691 19.1732 26.691 20C26.691 20.8268 25.7886 21.3967 23.9839 22.5365L23.102 23.0935C21.0686 24.3777 20.0519 25.0199 19.2759 24.5922C18.5 24.1645 18.5 22.962 18.5 20.557V19.443Z" fill="white"/>
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
            {formatTimeRU(totalSeconds)} / {formatTimeRU(dailyGoalSeconds)} º {pct}%
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
