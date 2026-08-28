import { useState } from "react";
import { TimeEntry, Settings } from "../db";
import { formatTime, formatTimeRU } from "../utils";
import { useTheme } from "../ThemeContext";

interface TodaySectionProps {
  last7Entries: TimeEntry[];
  settings: Settings;
  activeTaskId: string;
  isActive: boolean;
  // Tasks on the default ("No client") client never get an entry here —
  // see App.tsx.
  clientLabelByTaskId: Record<string, string>;
  // Subset of clientLabelByTaskId's keys — only present when that client's
  // avatar is in emoji mode (a letter/dash avatar has no real color of its
  // own to show). See App.tsx.
  clientDotColorByTaskId: Record<string, string>;
  onTaskClick: (taskId: string, date: string) => void;
  onTaskStart: (taskId: string) => void;
}

const PlayIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
    <defs>
      <linearGradient id="tspg" x1="2" y1="2" x2="12" y2="24" gradientUnits="userSpaceOnUse">
        <stop stopColor="#8FD75F" /><stop offset="1" stopColor="#31D877" />
      </linearGradient>
    </defs>
    <circle cx="12" cy="12" r="12" fill="url(#tspg)" />
    <path d="M8.5 11.443C8.5 9.038 8.5 7.836 9.276 7.408C10.052 6.980 11.069 7.622 13.102 8.906L13.984 9.464C15.789 10.603 16.691 11.173 16.691 12C16.691 12.827 15.789 13.397 13.984 14.536L13.102 15.094C11.069 16.378 10.052 17.020 9.276 16.592C8.5 16.164 8.5 14.962 8.5 12.557V11.443Z" fill="white" />
  </svg>
);

function getLocalDate(): string {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

// Renders inside the gray Timer card — only today's entries, on the
// card's own #F6F6F6 background. Yesterday/older days render separately,
// on the plain page background, via MainContent.
export default function TodaySection({ last7Entries, settings, activeTaskId, isActive, clientLabelByTaskId, clientDotColorByTaskId, onTaskClick, onTaskStart }: TodaySectionProps) {
  const { colors } = useTheme();
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const today = getLocalDate();
  const { dailyGoalSeconds } = settings;

  const todayEntries = last7Entries.filter((e) => e.date === today && e.endTime);

  const taskMap: Record<string, { name: string; totalSeconds: number; count: number; firstStartTime: string }> = {};
  todayEntries.forEach((e) => {
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

  const totalSeconds = todayEntries.reduce((s, e) => s + (e.durationSeconds ?? 0), 0);
  // No cap — past 100% we keep counting (125%, etc.) instead of pinning the
  // label at "100%" once the goal's been hit.
  const pct = dailyGoalSeconds > 0 ? Math.round((totalSeconds / dailyGoalSeconds) * 100) : 0;
  const overworked = dailyGoalSeconds > 0 && totalSeconds > dailyGoalSeconds;
  // The track itself never changes width. Under goal it's a single green
  // fill (as before). Past goal, the track is always full — it just splits
  // into how much of the actual time was "within goal" (green) vs overtime
  // (orange), so the green share shrinks the more you overwork.
  const greenPct = overworked ? (dailyGoalSeconds / totalSeconds) * 100 : Math.min(100, pct);
  const orangePct = overworked ? 100 - greenPct : 0;

  return (
    <div>
      <div style={{ padding: "0 8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0 8px" }}>
          <span style={{ fontSize: 16, fontWeight: 500, color: colors.textPrimary, lineHeight: "24px" }}>
            Today
          </span>
          <span style={{ fontSize: 16, color: colors.textPrimary, lineHeight: "24px", fontVariantNumeric: "tabular-nums", fontFamily: "'Inter', sans-serif" }}>
            {formatTimeRU(totalSeconds)} / {formatTimeRU(dailyGoalSeconds)} · {pct}%
          </span>
        </div>

        <div style={{ height: 8, borderRadius: 40, background: colors.progressTrack, overflow: "hidden", marginBottom: 8, display: "flex" }}>
          <div style={{ height: 8, width: `${greenPct}%`, flexShrink: 0, background: "linear-gradient(176deg, #8FD75F 24.6%, #31D877 69.3%)", boxShadow: "0px 4px 20px 0px rgba(33,152,81,0.3)" }} />
          {overworked && (
            <div style={{ height: 8, width: `${orangePct}%`, flexShrink: 0, background: "linear-gradient(176deg, #FF7552 24.6%, #FF5125 69.3%)", boxShadow: "0px 4px 20px 0px rgba(153,44,16,0.3)" }} />
          )}
        </div>
      </div>

      {tasks.length === 0 && (
        <div style={{ padding: "6px 8px", color: colors.textSecondary, fontSize: 15, lineHeight: "24px" }}>
          No tasks today
        </div>
      )}

      {tasks.map((task) => {
        const isTaskActive = task.id === activeTaskId && isActive;
        const isHovered = hoveredKey === task.id;
        return (
          <div
            key={task.id}
            onClick={() => onTaskClick(task.id, today)}
            onMouseEnter={() => setHoveredKey(task.id)}
            onMouseLeave={() => setHoveredKey(null)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              // 4px top + 4px bottom = 8px between adjacent task rows —
              // horizontal padding (8) untouched.
              padding: "4px 8px",
              borderRadius: 8,
              background: isHovered ? colors.cardRowHover : "transparent",
              cursor: "pointer",
              boxSizing: "border-box",
              transition: "background 0.3s ease",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0, overflow: "hidden" }}>
                <span style={{
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  fontSize: 15, color: colors.textPrimary, lineHeight: "24px", flexShrink: 1,
                }}>
                  {task.name}
                </span>
                {isTaskActive && (
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#34C759", flexShrink: 0 }} />
                )}
                {task.count > 1 && (
                  <span style={{
                    padding: "0 4px", background: colors.progressTrack,
                    borderRadius: 4, fontSize: 12, fontWeight: 500, color: colors.badgeText,
                    flexShrink: 0, textAlign: "center", lineHeight: "16px",
                  }}>
                    {task.count}
                  </span>
                )}
              </div>
              {clientLabelByTaskId[task.id] && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 4, minWidth: 0, overflow: "hidden",
                  // The task-name line above sits in a 24px line-height box
                  // for a 15px font, which leaves ~7px of unclaimed leading
                  // below the glyphs before this line even starts — cancel
                  // that out (-7), then add back the 4px gap actually
                  // wanted between the two lines.
                  marginTop: -3,
                }}>
                  <span style={{
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    fontSize: 12, lineHeight: "16px", color: colors.textSecondary,
                  }}>
                    {clientLabelByTaskId[task.id]}
                  </span>
                  {clientDotColorByTaskId[task.id] && (
                    <span style={{
                      width: 5, height: 5, borderRadius: "50%", flexShrink: 0,
                      background: clientDotColorByTaskId[task.id],
                    }} />
                  )}
                </div>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              {!isTaskActive && (
                <button
                  onClick={(e) => { e.stopPropagation(); onTaskStart(task.id); }}
                  style={{
                    width: 24, height: 24, background: "none", border: "none", padding: 0, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    opacity: isHovered ? 1 : 0,
                    pointerEvents: isHovered ? "auto" : "none",
                    transition: "opacity 0.3s ease",
                  }}
                >
                  <PlayIcon />
                </button>
              )}
              <span style={{
                width: 72, flexShrink: 0, textAlign: "right",
                fontSize: 15, color: colors.textPrimary,
                lineHeight: "24px", fontFamily: "'Inter', sans-serif", fontVariantNumeric: "tabular-nums",
              }}>
                {formatTime(task.totalSeconds)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
