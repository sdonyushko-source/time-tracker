import { useState, useEffect } from "react";
import { TimeEntry, getAllEntries } from "../db";
import { formatTime } from "../utils";

interface HistoryScreenProps {
  activeEntryId: string | null;
  onClose: () => void;
}

function formatDayLabel(dateStr: string): string {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const yestStr = `${yesterday.getFullYear()}-${pad(yesterday.getMonth() + 1)}-${pad(yesterday.getDate())}`;
  if (dateStr === todayStr) return "Today";
  if (dateStr === yestStr) return "Yesterday";
  const [y, m, d] = dateStr.split("-");
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });
}

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

interface TaskRow { name: string; seconds: number; isActive: boolean }
interface DayGroup { date: string; totalSeconds: number; tasks: TaskRow[] }
interface MonthGroup { ym: string; totalSeconds: number; days: DayGroup[] }

function groupEntries(entries: TimeEntry[], activeEntryId: string | null): MonthGroup[] {
  const monthMap = new Map<string, Map<string, Map<string, { seconds: number; isActive: boolean }>>>();
  for (const e of entries) {
    const ym = e.date.slice(0, 7);
    if (!monthMap.has(ym)) monthMap.set(ym, new Map());
    const dayMap = monthMap.get(ym)!;
    if (!dayMap.has(e.date)) dayMap.set(e.date, new Map());
    const taskMap = dayMap.get(e.date)!;
    const existing = taskMap.get(e.taskNameSnapshot) ?? { seconds: 0, isActive: false };
    existing.seconds += e.durationSeconds ?? 0;
    if (e.id === activeEntryId) existing.isActive = true;
    taskMap.set(e.taskNameSnapshot, existing);
  }
  const result: MonthGroup[] = [];
  for (const [ym, dayMap] of monthMap) {
    const days: DayGroup[] = [];
    for (const [date, taskMap] of dayMap) {
      const tasks = Array.from(taskMap.entries()).map(([name, v]) => ({ name, ...v }));
      days.push({ date, totalSeconds: tasks.reduce((s, t) => s + t.seconds, 0), tasks });
    }
    days.sort((a, b) => b.date.localeCompare(a.date));
    result.push({ ym, totalSeconds: days.reduce((s, d) => s + d.totalSeconds, 0), days });
  }
  result.sort((a, b) => b.ym.localeCompare(a.ym));
  return result;
}

export default function HistoryScreen({ activeEntryId, onClose }: HistoryScreenProps) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [showFullMonth, setShowFullMonth] = useState(false);
  useEffect(() => { getAllEntries().then(setEntries); }, []);
  const groups = groupEntries(entries, activeEntryId);
  const thisYM = currentYearMonth();
  const currentMonth = groups.find((g) => g.ym === thisYM);
  const pastMonths = groups.filter((g) => g.ym !== thisYM);
  const visibleDays = currentMonth ? (showFullMonth ? currentMonth.days : currentMonth.days.slice(0, 7)) : [];
  return (
    <div style={{ width: 440, background: "#FFFFFF", fontFamily: "'Inter', sans-serif", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 24px", height: 40, boxSizing: "border-box" }}>
        <span style={{ fontSize: 20, fontWeight: 500, color: "#181A2C", lineHeight: "24px" }}>History</span>
        <button onClick={onClose} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6L18 18" stroke="#181A2C" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </button>
      </div>
      <div style={{ padding: "16px 24px", display: "flex", flexDirection: "column", gap: 24 }}>
        {currentMonth && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {visibleDays.map((day) => (
              <div key={day.date} style={{ border: "1px solid #E3E5EA", borderRadius: 12, paddingTop: 12, paddingBottom: 8, paddingLeft: 8, paddingRight: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "0 12px", fontWeight: 500, fontSize: 16, color: "#181A2C", lineHeight: "24px" }}>
                  <span>{formatDayLabel(day.date)}</span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatTime(day.totalSeconds)}</span>
                </div>
                {day.tasks.map((task, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 12px", borderRadius: 8, background: "white" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, width: 264, overflow: "hidden" }}>
                      <span style={{ fontSize: 16, color: "#181A2C", lineHeight: "24px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.name}</span>
                      {task.isActive && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#34C759", flexShrink: 0 }} />}
                    </div>
                    <span style={{ fontSize: 16, color: "#181A2C", lineHeight: "24px", fontVariantNumeric: "tabular-nums", width: 72, textAlign: "right" }}>{formatTime(task.seconds)}</span>
                  </div>
                ))}
              </div>
            ))}
            {currentMonth.days.length > 7 && !showFullMonth && (
              <button onClick={() => setShowFullMonth(true)} style={{ height: 48, background: "#F6F6F6", border: "none", borderRadius: 8, fontSize: 16, color: "#181A2C", fontFamily: "'Inter', sans-serif", cursor: "pointer", width: "100%" }}>Show full month</button>
            )}
          </div>
        )}
        {pastMonths.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pastMonths.map((month) => (
              <div key={month.ym} style={{ border: "1px solid #E3E5EA", borderRadius: 12, padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 16, fontWeight: 500, color: "#181A2C", lineHeight: "24px" }}>{formatMonthLabel(month.ym)}</span>
                <span style={{ fontSize: 16, fontWeight: 500, color: "#181A2C", lineHeight: "24px", fontVariantNumeric: "tabular-nums" }}>{formatTime(month.totalSeconds)}</span>
              </div>
            ))}
          </div>
        )}
        {entries.length === 0 && (
          <div style={{ textAlign: "center", color: "#908F8F", fontSize: 16, paddingTop: 40 }}>No history yet</div>
        )}
      </div>
    </div>
  );
}
