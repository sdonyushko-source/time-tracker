import { useState, useEffect, useRef, Fragment } from "react";
import { Settings, TimeEntry, getAllEntries } from "../db";
import { formatTime, formatAmount } from "../utils";
import { useTheme } from "../ThemeContext";
import TitleBarSpacer from "./TitleBarSpacer";

interface HistoryScreenProps {
  activeEntryId: string | null;
  focusDate?: string | null;
  settings: Settings;
  onClose: () => void;
  onEntryClick: (taskId: string, date: string) => void;
}

// Points left at rest (collapsed); rotating -90deg (counter-clockwise) swings
// it down for the expanded state.
const ChevronIcon = ({ expanded, color }: { expanded: boolean; color: string }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ transform: expanded ? "rotate(-90deg)" : "none", transition: "transform 0.2s ease", flexShrink: 0 }}>
    <path d="M9.97259 3.20001C10.6019 2.70559 11.4999 3.17597 11.4999 4.00002L11.4999 12C11.4999 12.8241 10.6019 13.2944 9.97259 12.8L4.88168 8.80001C4.37259 8.40001 4.37259 7.60001 4.88168 7.20001L9.97259 3.20001Z" fill={color} />
  </svg>
);

export function formatDayLabel(dateStr: string): string {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const yestStr = `${yesterday.getFullYear()}-${pad(yesterday.getMonth() + 1)}-${pad(yesterday.getDate())}`;
  if (dateStr === todayStr) return "Today";
  if (dateStr === yestStr) return "Yesterday";
  const [y, m, d] = dateStr.split("-");
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

interface TaskRow { taskId: string; name: string; seconds: number; isActive: boolean }
interface DayGroup { date: string; totalSeconds: number; totalAmount: number; tasks: TaskRow[] }
interface MonthGroup { ym: string; totalSeconds: number; totalAmount: number; days: DayGroup[] }

// Amount is summed from each entry's own hourlyRateSnapshot, not a flat
// rate — rate lives per-client now (see Client in db.ts), so entries
// tracked under different clients (or at a rate later changed) never
// shared a single number to begin with.
function groupEntries(entries: TimeEntry[], activeEntryId: string | null): MonthGroup[] {
  const monthMap = new Map<string, Map<string, Map<string, { name: string; seconds: number; amount: number; isActive: boolean }>>>();
  for (const e of entries) {
    const ym = e.date.slice(0, 7);
    if (!monthMap.has(ym)) monthMap.set(ym, new Map());
    const dayMap = monthMap.get(ym)!;
    if (!dayMap.has(e.date)) dayMap.set(e.date, new Map());
    const taskMap = dayMap.get(e.date)!;
    const existing = taskMap.get(e.taskId) ?? { name: e.taskNameSnapshot, seconds: 0, amount: 0, isActive: false };
    existing.seconds += e.durationSeconds ?? 0;
    existing.amount += ((e.durationSeconds ?? 0) / 3600) * (e.hourlyRateSnapshot ?? 0);
    if (e.id === activeEntryId) existing.isActive = true;
    taskMap.set(e.taskId, existing);
  }
  const result: MonthGroup[] = [];
  for (const [ym, dayMap] of monthMap) {
    const days: DayGroup[] = [];
    for (const [date, taskMap] of dayMap) {
      const tasks = Array.from(taskMap.entries()).map(([taskId, v]) => ({ taskId, ...v }));
      days.push({
        date,
        totalSeconds: tasks.reduce((s, t) => s + t.seconds, 0),
        totalAmount: tasks.reduce((s, t) => s + t.amount, 0),
        tasks,
      });
    }
    days.sort((a, b) => b.date.localeCompare(a.date));
    result.push({
      ym,
      totalSeconds: days.reduce((s, d) => s + d.totalSeconds, 0),
      totalAmount: days.reduce((s, d) => s + d.totalAmount, 0),
      days,
    });
  }
  result.sort((a, b) => b.ym.localeCompare(a.ym));
  return result;
}

export default function HistoryScreen({ activeEntryId, focusDate, settings, onClose, onEntryClick }: HistoryScreenProps) {
  const { colors } = useTheme();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [showFullMonth, setShowFullMonth] = useState(false);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [highlightKey, setHighlightKey] = useState<string | null>(null);
  const [hoveredTaskKey, setHoveredTaskKey] = useState<string | null>(null);
  const dayRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const monthRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => { getAllEntries().then(setEntries); }, []);

  const toggleMonth = (ym: string) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(ym)) next.delete(ym); else next.add(ym);
      return next;
    });
  };

  const groups = groupEntries(entries, activeEntryId);
  const thisYM = currentYearMonth();
  const currentMonth = groups.find((g) => g.ym === thisYM);
  const pastMonths = groups.filter((g) => g.ym !== thisYM);
  const visibleDays = currentMonth ? (showFullMonth || focusDate ? currentMonth.days : currentMonth.days.slice(0, 7)) : [];

  // Jump to (and briefly highlight) whatever date the main screen was
  // clicked at. Dates in the current month get their own day card; older
  // dates only exist as a collapsed month row, so that's what we highlight.
  useEffect(() => {
    if (!focusDate || entries.length === 0) return;
    const ym = focusDate.slice(0, 7);
    const key = ym === thisYM ? focusDate : ym;
    const raf = requestAnimationFrame(() => {
      const el = ym === thisYM ? dayRefs.current[focusDate] : monthRefs.current[ym];
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightKey(key);
    });
    const timeout = setTimeout(() => setHighlightKey(null), 2000);
    return () => { cancelAnimationFrame(raf); clearTimeout(timeout); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusDate, entries.length]);

  const renderDayCard = (day: DayGroup, highlighted: boolean, refCallback?: (el: HTMLDivElement | null) => void) => (
    <div
      ref={refCallback}
      style={{ display: "flex", flexDirection: "column", gap: 4, borderRadius: 8 }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 500, fontSize: 15, color: colors.textPrimary, lineHeight: "24px" }}>
        <span style={{ color: highlighted ? "#7381D3" : colors.textPrimary, transition: "color 0.6s ease" }}>{formatDayLabel(day.date)}</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatTime(day.totalSeconds)}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {day.tasks.map((task) => {
          const taskKey = `${day.date}-${task.taskId}`;
          const isTaskHovered = hoveredTaskKey === taskKey;
          return (
            <div
              key={task.taskId}
              onClick={() => onEntryClick(task.taskId, day.date)}
              onMouseEnter={() => setHoveredTaskKey(taskKey)}
              onMouseLeave={() => setHoveredTaskKey(null)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "3px 8px", margin: "0 -8px", borderRadius: 8,
                background: isTaskHovered ? colors.cardBg : "transparent",
                cursor: "pointer", boxSizing: "border-box", transition: "background 0.3s ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, overflow: "hidden", minWidth: 0 }}>
                <span style={{ fontSize: 13, color: colors.textPrimary, lineHeight: "18px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.name}</span>
                {task.isActive && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#34C759", flexShrink: 0 }} />}
              </div>
              <span style={{ fontSize: 13, color: colors.textPrimary, lineHeight: "18px", fontVariantNumeric: "tabular-nums", flexShrink: 0, fontFamily: "'Inter', sans-serif" }}>{formatTime(task.seconds)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );

  // One flat list — every day-card and month-row is a direct sibling with a
  // uniform 8px gap, matching the Figma reference exactly (rather than two
  // differently-spaced sections). A hairline separator sits between adjacent
  // blocks, except right after an expanded month's header (straight into its
  // first day, no line) and before the very first block on the page.
  const blocks: { key: string; node: React.ReactNode; noSeparator?: boolean }[] = [];

  visibleDays.forEach((day) => {
    blocks.push({
      key: `day-${day.date}`,
      node: renderDayCard(day, highlightKey === day.date, (el) => { dayRefs.current[day.date] = el; }),
    });
  });

  if (currentMonth && currentMonth.days.length > 7 && !showFullMonth && !focusDate) {
    blocks.push({
      key: "show-full-month",
      node: <button onClick={() => setShowFullMonth(true)} style={{ height: 40, background: colors.cardBg, border: "none", borderRadius: 8, fontSize: 15, color: colors.textPrimary, fontFamily: "'Inter', sans-serif", cursor: "pointer", width: "100%" }}>Show full month</button>,
    });
  }

  pastMonths.forEach((month) => {
    const isExpanded = expandedMonths.has(month.ym);
    const isHighlighted = highlightKey === month.ym;
    const amount = month.totalAmount;
    blocks.push({
      key: `month-${month.ym}`,
      node: (
        <div
          ref={(el) => { monthRefs.current[month.ym] = el; }}
          onClick={() => toggleMonth(month.ym)}
          style={{
            display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer",
            borderRadius: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 500, color: isHighlighted ? "#7381D3" : colors.textPrimary, lineHeight: "24px", transition: "color 0.6s ease" }}>{formatMonthLabel(month.ym)}</span>
            <ChevronIcon expanded={isExpanded} color={colors.textPrimary} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 15, fontWeight: 500, color: colors.textPrimary, lineHeight: "24px", fontVariantNumeric: "tabular-nums" }}>{formatTime(month.totalSeconds)}</span>
            <span style={{ fontSize: 15, color: colors.textPrimary, lineHeight: "24px", fontVariantNumeric: "tabular-nums" }}>{formatAmount(amount, settings.currency)}</span>
          </div>
        </div>
      ),
    });

    if (isExpanded) {
      month.days.forEach((day, i) => {
        blocks.push({
          key: `month-${month.ym}-day-${day.date}`,
          noSeparator: i === 0,
          node: renderDayCard(day, false),
        });
      });
    }
  });

  return (
    <div style={{ width: 440, height: "100vh", background: colors.pageBg, fontFamily: "'Inter', sans-serif", display: "flex", flexDirection: "column", overflow: "hidden", boxSizing: "border-box" }}>
      <TitleBarSpacer />
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "24px 24px 0" }}>
        <span style={{ fontSize: 20, fontWeight: 500, color: colors.textPrimary, lineHeight: "24px" }}>History</span>
        <button onClick={onClose} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6L18 18" stroke={colors.textPrimary} strokeWidth="1.5" strokeLinecap="round"/></svg>
        </button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
        {blocks.map((b, idx) => (
          <Fragment key={b.key}>
            {idx > 0 && !b.noSeparator && <div style={{ height: 1, background: colors.border, flexShrink: 0 }} />}
            {b.node}
          </Fragment>
        ))}
        {entries.length === 0 && (
          <div style={{ textAlign: "center", color: colors.textSecondary, fontSize: 16, paddingTop: 40 }}>No history yet</div>
        )}
      </div>
    </div>
  );
}
