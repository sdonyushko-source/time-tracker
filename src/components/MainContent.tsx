import { useState } from "react";
import { TimeEntry } from "../db";
import { formatTime, formatTimeRU } from "../utils";
import { useTheme } from "../ThemeContext";

interface MainContentProps {
  recentEntries: TimeEntry[];
  onDateClick: (date: string) => void;
  onTaskClick: (taskId: string, date: string) => void;
  onTaskStart: (taskId: string) => void;
}

const PlayIcon = ({ size = 24 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none">
    <defs>
      <linearGradient id="mcpg" x1="2" y1="2" x2="12" y2="24" gradientUnits="userSpaceOnUse">
        <stop stopColor="#8FD75F" /><stop offset="1" stopColor="#31D877" />
      </linearGradient>
    </defs>
    <circle cx="12" cy="12" r="12" fill="url(#mcpg)" />
    <path d="M8.5 11.443C8.5 9.038 8.5 7.836 9.276 7.408C10.052 6.980 11.069 7.622 13.102 8.906L13.984 9.464C15.789 10.603 16.691 11.173 16.691 12C16.691 12.827 15.789 13.397 13.984 14.536L13.102 15.094C11.069 16.378 10.052 17.020 9.276 16.592C8.5 16.164 8.5 14.962 8.5 12.557V11.443Z" fill="white" />
  </svg>
);

function getYesterdayDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function formatDateLabel(date: string, yesterday: string): string {
  if (date === yesterday) return "Yesterday";
  const d = new Date(date + "T12:00:00");
  const weekday = d.toLocaleString("en-US", { weekday: "short" });
  return `${weekday}, ${d.getDate()} ${d.toLocaleString("en-US", { month: "short" })}`;
}

// Shows the 5 most recent past days that actually have entries (see
// getRecentDaysEntries — reaches back past 7 calendar days if there are
// gaps, so the list doesn't under-fill). The most recent of those gets its
// own muted task breakdown (same click-to-edit / hover-to-start mechanic as
// TodaySection, just visually de-emphasized) so the page doesn't feel empty
// right after midnight. Older days stay a plain date + total-time row each
// — that detail lives in History instead.
export default function MainContent({ recentEntries, onDateClick, onTaskClick, onTaskStart }: MainContentProps) {
  const { colors } = useTheme();
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);

  const yesterday = getYesterdayDate();

  const totals: Record<string, number> = {};
  recentEntries.forEach((e) => {
    if (!e.endTime) return;
    totals[e.date] = (totals[e.date] ?? 0) + (e.durationSeconds ?? 0);
  });

  const pastDates = Object.keys(totals).sort((a, b) => b.localeCompare(a));

  if (pastDates.length === 0) return null;

  const lastActiveDate = pastDates[0];

  const lastActiveTaskMap: Record<string, { name: string; totalSeconds: number; count: number; firstStartTime: string }> = {};
  recentEntries.forEach((e) => {
    if (!e.endTime || e.date !== lastActiveDate) return;
    if (!lastActiveTaskMap[e.taskId]) {
      lastActiveTaskMap[e.taskId] = { name: e.taskNameSnapshot, totalSeconds: 0, count: 0, firstStartTime: e.startTime };
    } else if (e.startTime < lastActiveTaskMap[e.taskId].firstStartTime) {
      lastActiveTaskMap[e.taskId].firstStartTime = e.startTime;
    }
    lastActiveTaskMap[e.taskId].count += 1;
    lastActiveTaskMap[e.taskId].totalSeconds += e.durationSeconds ?? 0;
  });
  const lastActiveTasks = Object.entries(lastActiveTaskMap)
    .map(([id, t]) => ({ id, ...t }))
    .sort((a, b) => a.firstStartTime.localeCompare(b.firstStartTime));

  return (
    <div style={{ display: "flex", flexDirection: "column", paddingBottom: 16 }}>
      {pastDates.map((date, dayIdx) => {
        const isLastActive = date === lastActiveDate;
        const isHovered = hoveredDate === date;
        return (
          <div key={date}>
            {dayIdx > 0 && <div style={{ height: 1, background: colors.border, margin: "4px 16px" }} />}
            <div
              onClick={() => onDateClick(date)}
              onMouseEnter={() => setHoveredDate(date)}
              onMouseLeave={() => setHoveredDate(null)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 12px",
                borderRadius: 8,
                background: isHovered ? colors.cardBg : "transparent",
                cursor: "pointer",
                boxSizing: "border-box",
                transition: "background 0.3s ease",
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 500, color: colors.textSecondary, lineHeight: "16px" }}>
                {formatDateLabel(date, yesterday)}
              </span>
              <span style={{ fontSize: 12, fontWeight: isLastActive ? 500 : 600, color: colors.textSecondary, lineHeight: "16px", fontVariantNumeric: "tabular-nums", fontFamily: "'Inter', sans-serif" }}>
                {formatTimeRU(totals[date])}
              </span>
            </div>
            {isLastActive && lastActiveTasks.length > 0 && (
              <div style={{ paddingBottom: 8 }}>
                {lastActiveTasks.map((task) => {
                  const isTaskHovered = hoveredTaskId === task.id;
                  return (
                    <div
                      key={task.id}
                      onClick={() => onTaskClick(task.id, lastActiveDate)}
                      onMouseEnter={() => setHoveredTaskId(task.id)}
                      onMouseLeave={() => setHoveredTaskId(null)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "4px 12px",
                        borderRadius: 8,
                        background: isTaskHovered ? colors.cardBg : "transparent",
                        cursor: "pointer",
                        boxSizing: "border-box",
                        transition: "background 0.3s ease",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1, minWidth: 0, overflow: "hidden" }}>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12, color: colors.textSecondary, lineHeight: "16px", flexShrink: 1 }}>
                          {task.name}
                        </span>
                        {task.count > 1 && (
                          <span style={{
                            padding: "0 4px", background: isTaskHovered ? colors.inputBg : colors.badgeBg,
                            borderRadius: 4, fontSize: 12, fontWeight: 500, color: colors.badgeText,
                            flexShrink: 0, textAlign: "center", lineHeight: "16px",
                            transition: "background 0.3s ease",
                          }}>
                            {task.count}
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); onTaskStart(task.id); }}
                          style={{
                            width: 24, height: 24, margin: "-4px 0", background: "none", border: "none", padding: 0, cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            opacity: isTaskHovered ? 1 : 0,
                            pointerEvents: isTaskHovered ? "auto" : "none",
                            transition: "opacity 0.3s ease",
                          }}
                        >
                          <PlayIcon />
                        </button>
                        <span style={{ width: 72, flexShrink: 0, textAlign: "right", fontSize: 12, color: colors.textSecondary, lineHeight: "16px", fontFamily: "'Inter', sans-serif", fontVariantNumeric: "tabular-nums" }}>
                          {formatTime(task.totalSeconds)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
