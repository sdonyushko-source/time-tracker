import { useState, useEffect, useRef, Fragment } from "react";
import { Settings, TimeEntry, getAllEntries } from "../db";
import { formatTimeRU, formatAmount, buildMonthlyReportText, copyTextToClipboard, formatMonthDateRange } from "../utils";
import { useTheme } from "../ThemeContext";
import ButtonBar from "./ButtonBar";
import TitleBarSpacer from "./TitleBarSpacer";

interface StatisticsScreenProps {
  settings: Settings;
  onClose: () => void;
}

type Period = "month" | "year" | "custom";
type CustomGranularity = "day" | "week" | "month";

// Fixed per-segment width for the Month/Year/Custom tabs — sized to fit
// "Custom" (the widest label) at 13px medium. The control now sits beside
// the period navigator in one row, so it can no longer stretch full-width.
const SEGMENT_W = 60;

// Breakdown's hours/money columns — wide enough that big numbers like
// "800ч 00м" and "$80,000.00" never wrap, for both the per-task rows and
// the total row underneath (both use the same widths so everything lines
// up in a single column).
const BREAKDOWN_HOURS_W = 76;
const BREAKDOWN_MONEY_W = 100;

// How many bars to actually label along the X axis — dense bar counts
// (weekly buckets over a year, daily buckets over 6 weeks) would overlap
// if every single one got a text label, so this thins them out while
// always keeping the first and last.
function thinShowLabel(i: number, total: number): boolean {
  if (total <= 10) return true;
  const step = Math.ceil(total / 8);
  return i === 0 || i === total - 1 || i % step === 0;
}

// ── date helpers ──────────────────────────────────────────────────────────
// Statistics needs an arbitrary-anchor variant of the today-only helpers
// already in db.ts (weekStart/monthStart), so these live here instead of
// being force-fit into that file.

function toDateStr(d: Date): string {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function startOfWeek(d: Date): Date {
  const nd = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = (nd.getDay() + 6) % 7; // Monday = 0, matches db.ts weekStart()
  nd.setDate(nd.getDate() - diff);
  return nd;
}

function addDays(d: Date, n: number): Date {
  const nd = new Date(d);
  nd.setDate(nd.getDate() + n);
  return nd;
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function topRoundedRectPath(x: number, y: number, w: number, h: number, r: number): string {
  if (h <= 0) return "";
  const rr = Math.max(0, Math.min(r, h, w / 2));
  return `M${x},${y + h} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${y + h} Z`;
}

// ── chart ────────────────────────────────────────────────────────────────

interface Bar {
  key: string;
  value: number;
  label: string;
  dateLabel: string;
  showLabel: boolean;
  onClick?: () => void;
  // Appended after the formatted duration in the tooltip — used by
  // multi-day buckets (weekly/monthly) to make clear the number shown is a
  // per-day average for that period, not the period's total.
  valueSuffix?: string;
}

// Per-day selection was removed — the chart is purely a hover-to-inspect
// view now (day detail lives in History instead). Every bar reads the same
// green, and the tooltip just follows whichever bar the pointer is over.
function BarChart({ bars, goalSeconds, colors }: { bars: Bar[]; goalSeconds: number | null; colors: ReturnType<typeof useTheme>["colors"] }) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const width = 392;
  const height = 130;
  const chartTop = 24;
  const chartBottom = height - 18;
  const barAreaHeight = chartBottom - chartTop;
  const gap = bars.length > 20 ? 1.5 : 3;
  const barWidth = (width - gap * (bars.length - 1)) / bars.length;
  const rx = Math.max(2, Math.min(6, barWidth * 0.3));

  const maxVal = Math.max(...bars.map((b) => b.value), goalSeconds ?? 0, 60) * 1.1;
  const barY = (v: number) => chartBottom - (v / maxVal) * barAreaHeight;
  // Zero stays zero height (no sliver) — the baseline below anchors those
  // bars visually instead. Only a real (however small) value gets the 2px
  // floor so it doesn't disappear.
  const barH = (v: number) => (v > 0 ? Math.max(2, (v / maxVal) * barAreaHeight) : 0);

  const tooltipBar = hoveredKey ? bars.find((b) => b.key === hoveredKey) : undefined;
  const valueText = tooltipBar ? formatTimeRU(tooltipBar.value) + (tooltipBar.valueSuffix ?? "") : "";
  const dateText = tooltipBar ? tooltipBar.dateLabel : "";
  const calloutW = Math.max(48, Math.max(valueText.length * 6.5, dateText.length * 5.5) + 16);
  const calloutH = 30;
  const tooltipIdx = tooltipBar ? bars.indexOf(tooltipBar) : -1;
  const rawCx = tooltipIdx >= 0 ? tooltipIdx * (barWidth + gap) + barWidth / 2 : 0;
  // Clamp so the pill never runs past the chart's own edges — e.g. picking
  // the last day of the month would otherwise push it half off-screen.
  const calloutCx = Math.min(width - calloutW / 2, Math.max(calloutW / 2, rawCx));
  const calloutY = tooltipBar ? Math.max(2, barY(tooltipBar.value) - calloutH - 6) : 0;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* Baseline — with zero-value bars now rendering at 0 height (no thin
          sliver), this anchors the chart's bottom edge so empty days still
          read as "part of the chart" instead of just blank space. */}
      <line x1={0} x2={width} y1={chartBottom} y2={chartBottom} stroke={colors.border} strokeWidth={1} />
      {goalSeconds != null && goalSeconds > 0 && (
        <line
          x1={0} x2={width}
          y1={Math.min(chartBottom, Math.max(chartTop, barY(goalSeconds)))}
          y2={Math.min(chartBottom, Math.max(chartTop, barY(goalSeconds)))}
          stroke={colors.textSecondary} strokeWidth={1} strokeDasharray="4 4"
        />
      )}
      {bars.map((b, i) => {
        const x = i * (barWidth + gap);
        // No entries yet (empty past day or a day that hasn't happened) —
        // nothing to inspect, so no hover/tooltip for it.
        const hoverable = b.value > 0;
        return (
          <g
            key={b.key}
            onClick={b.onClick}
            onMouseEnter={hoverable ? () => setHoveredKey(b.key) : undefined}
            onMouseLeave={hoverable ? () => setHoveredKey((k) => (k === b.key ? null : k)) : undefined}
            style={{ cursor: b.onClick ? "pointer" : "default" }}
          >
            <rect x={x} y={0} width={barWidth} height={height} fill="transparent" />
            {goalSeconds != null && goalSeconds > 0 && b.value > goalSeconds ? (
              <>
                {/* Over goal — the slice above the dashed line is overtime
                    (orange), the rest stays the usual green. */}
                <path
                  d={topRoundedRectPath(x, barY(b.value), barWidth, barY(goalSeconds) - barY(b.value), rx)}
                  fill="url(#statChartGradOrange)"
                />
                <rect x={x} y={barY(goalSeconds)} width={barWidth} height={chartBottom - barY(goalSeconds)} fill="url(#statChartGrad)" />
              </>
            ) : (
              <path
                d={topRoundedRectPath(x, barY(b.value), barWidth, barH(b.value), rx)}
                fill="url(#statChartGrad)"
              />
            )}
            {b.showLabel && (
              <text x={x + barWidth / 2} y={height - 4} textAnchor="middle" fontSize={10} fill={colors.textSecondary} fontFamily="'Inter', sans-serif">
                {b.label}
              </text>
            )}
          </g>
        );
      })}
      {tooltipBar && (
        <g>
          <rect x={calloutCx - calloutW / 2} y={calloutY} width={calloutW} height={calloutH} rx={7} fill="#181A2C" />
          <text x={calloutCx} y={calloutY + 12} textAnchor="middle" fontSize={9} fill="#FFFFFF" fillOpacity={0.7} fontFamily="'Inter', sans-serif">
            {dateText}
          </text>
          <text x={calloutCx} y={calloutY + 24} textAnchor="middle" fontSize={11} fill="#FFFFFF" fontFamily="'Inter', sans-serif" style={{ fontVariantNumeric: "tabular-nums" }}>
            {valueText}
          </text>
        </g>
      )}
      <defs>
        <linearGradient id="statChartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#8FD75F" />
          <stop offset="1" stopColor="#31D877" />
        </linearGradient>
        <linearGradient id="statChartGradOrange" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#FF7552" />
          <stop offset="1" stopColor="#FF5125" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// YYYY-MM-DD -> DD.MM.YYYY, matching the display format used by the other
// date fields in the app (EditActiveEntryScreen/EditTimeEntryScreen).
function formatDateDisplay(dateValue: string): string {
  if (!dateValue) return "";
  const [yyyy, mm, dd] = dateValue.split("-");
  return `${dd}.${mm}.${yyyy}`;
}

// ── screen ───────────────────────────────────────────────────────────────

export default function StatisticsScreen({ settings, onClose }: StatisticsScreenProps) {
  const theme = useTheme();
  const { colors } = theme;
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [period, setPeriod] = useState<Period>("month");
  const [pointerTs, setPointerTs] = useState<number>(() => new Date(new Date().setHours(0, 0, 0, 0)).getTime());
  // Custom range — defaults to the last 30 days so the tab isn't blank the
  // first time it's opened.
  const [customStart, setCustomStart] = useState<string>(() => toDateStr(addDays(new Date(), -29)));
  const [customEnd, setCustomEnd] = useState<string>(() => toDateStr(new Date()));
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { getAllEntries().then(setEntries); }, []);

  const pointerDate = new Date(pointerTs);

  // Completed entries only (endTime set) — matches the aggregation
  // convention used everywhere else in the app (MainContent, TodaySection,
  // getLast7DaysEntries), so a still-running entry never skews the chart.
  const completed = entries.filter((e) => e.endTime);
  const totalsByDate: Record<string, number> = {};
  completed.forEach((e) => { totalsByDate[e.date] = (totalsByDate[e.date] ?? 0) + (e.durationSeconds ?? 0); });

  const monthDays = (() => {
    const y = pointerDate.getFullYear(), m = pointerDate.getMonth();
    return Array.from({ length: daysInMonth(y, m) }, (_, i) => toDateStr(new Date(y, m, i + 1)));
  })();
  const yearMonths = (() => {
    const y = pointerDate.getFullYear();
    return Array.from({ length: 12 }, (_, i) => {
      const ym = `${y}-${String(i + 1).padStart(2, "0")}`;
      const total = completed.filter((e) => e.date.slice(0, 7) === ym).reduce((s, e) => s + (e.durationSeconds ?? 0), 0);
      return { ym, label: new Date(y, i, 1).toLocaleString("en-US", { month: "short" }), total };
    });
  })();

  const shiftPeriod = (dir: 1 | -1) => {
    if (period === "month") setPointerTs(new Date(pointerDate.getFullYear(), pointerDate.getMonth() + dir, 1).getTime());
    else if (period === "year") setPointerTs(new Date(pointerDate.getFullYear() + dir, 0, 1).getTime());
  };

  const switchPeriod = (p: Period) => {
    setPeriod(p);
    setPointerTs(new Date(new Date().setHours(0, 0, 0, 0)).getTime());
  };

  const jumpIntoMonth = (ym: string) => {
    const [y, m] = ym.split("-").map(Number);
    setPeriod("month");
    setPointerTs(new Date(y, m - 1, 1).getTime());
  };

  // Keep the range sane as either endpoint is edited — dragging Start past
  // End (or vice versa) just pulls the other one along instead of leaving
  // an inverted, empty range.
  const handleCustomStartChange = (v: string) => {
    setCustomStart(v);
    if (customEnd && v > customEnd) setCustomEnd(v);
  };
  const handleCustomEndChange = (v: string) => {
    setCustomEnd(v);
    if (customStart && v < customStart) setCustomStart(v);
  };

  // Custom range's day list — the only place bucket granularity adapts to
  // the selected span; Month stays daily, Year stays monthly regardless.
  const customDays = (() => {
    if (!customStart || !customEnd || customStart > customEnd) return [];
    const days: string[] = [];
    let cur = new Date(customStart + "T12:00:00");
    const end = new Date(customEnd + "T12:00:00");
    while (cur <= end) { days.push(toDateStr(cur)); cur = addDays(cur, 1); }
    return days;
  })();
  const customGranularity: CustomGranularity =
    customDays.length <= 42 ? "day" : customDays.length <= 365 ? "week" : "month";

  // ── period label + chart bars ──
  let navLabel: string;
  let reportRangeLabel: string;
  let bars: Bar[];
  let goalSeconds: number | null = null;
  let periodTotal = 0;
  let unitsWithData = 0;
  let averageSeconds = 0;

  if (period === "month") {
    navLabel = pointerDate.toLocaleString("en-US", { month: "short", year: "numeric" });
    const ym = pointerDate.getFullYear() + "-" + String(pointerDate.getMonth() + 1).padStart(2, "0");
    reportRangeLabel = formatMonthDateRange(ym);
    bars = monthDays.map((d, i) => ({
      key: d,
      value: totalsByDate[d] ?? 0,
      label: String(i + 1),
      dateLabel: new Date(d + "T12:00:00").toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric" }),
      showLabel: i === 0 || (i + 1) % 5 === 0,
    }));
    goalSeconds = settings.dailyGoalSeconds > 0 ? settings.dailyGoalSeconds : null;
    periodTotal = monthDays.reduce((s, d) => s + (totalsByDate[d] ?? 0), 0);
    unitsWithData = monthDays.filter((d) => (totalsByDate[d] ?? 0) > 0).length;
    averageSeconds = unitsWithData > 0 ? periodTotal / unitsWithData : 0;
  } else if (period === "year") {
    navLabel = String(pointerDate.getFullYear());
    reportRangeLabel = navLabel;
    bars = yearMonths.map((m) => ({
      key: m.ym,
      value: m.total,
      label: m.label,
      dateLabel: m.label,
      showLabel: true,
      onClick: () => jumpIntoMonth(m.ym),
    }));
    // A flat daily-goal line doesn't translate to monthly-total bars
    // (months have different lengths), so it's only shown at day
    // granularity — see BarChart's goalSeconds prop.
    periodTotal = yearMonths.reduce((s, m) => s + m.total, 0);
    // "Daily average" always means per-day, even in Year view where the
    // chart itself is bucketed by month — so count actual calendar days
    // with entries, not months with entries.
    const yearPrefix = String(pointerDate.getFullYear());
    unitsWithData = Object.keys(totalsByDate).filter((d) => d.startsWith(yearPrefix) && totalsByDate[d] > 0).length;
    averageSeconds = unitsWithData > 0 ? periodTotal / unitsWithData : 0;
  } else {
    // Custom — bucket size (day/week/month) tracks customGranularity.
    const sD = customDays.length ? new Date(customDays[0] + "T12:00:00") : null;
    const eD = customDays.length ? new Date(customDays[customDays.length - 1] + "T12:00:00") : null;
    navLabel = sD && eD
      ? `${sD.toLocaleString("en-US", { month: "short" })} ${sD.getDate()} – ${eD.toLocaleString("en-US", { month: "short" })} ${eD.getDate()}`
      : "";
    reportRangeLabel = navLabel;

    if (customGranularity === "day") {
      bars = customDays.map((d, i) => ({
        key: d,
        value: totalsByDate[d] ?? 0,
        label: String(new Date(d + "T12:00:00").getDate()),
        dateLabel: new Date(d + "T12:00:00").toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric" }),
        showLabel: thinShowLabel(i, customDays.length),
      }));
      goalSeconds = settings.dailyGoalSeconds > 0 ? settings.dailyGoalSeconds : null;
      periodTotal = customDays.reduce((s, d) => s + (totalsByDate[d] ?? 0), 0);
      unitsWithData = customDays.filter((d) => (totalsByDate[d] ?? 0) > 0).length;
      averageSeconds = unitsWithData > 0 ? periodTotal / unitsWithData : 0;
    } else if (customGranularity === "week") {
      // Each bar is a whole calendar week (Mon–Sun), but its height is the
      // *average* seconds/day across whichever of those days actually fall
      // inside the selected range — not the week's total — so it stays
      // directly comparable to the (unscaled) daily goal line and reads
      // consistently with the single-day bars in "day" granularity.
      const weekTotal = new Map<string, number>();
      const weekDayCount = new Map<string, number>();
      customDays.forEach((d) => {
        const wk = toDateStr(startOfWeek(new Date(d + "T12:00:00")));
        weekTotal.set(wk, (weekTotal.get(wk) ?? 0) + (totalsByDate[d] ?? 0));
        weekDayCount.set(wk, (weekDayCount.get(wk) ?? 0) + 1);
      });
      const weekStarts = Array.from(weekTotal.keys()).sort();
      bars = weekStarts.map((wk, i) => {
        const wd = new Date(wk + "T12:00:00");
        const weekEnd = addDays(wd, 6);
        const total = weekTotal.get(wk) ?? 0;
        const dayCount = weekDayCount.get(wk) ?? 1;
        return {
          key: wk,
          value: total / dayCount,
          label: String(wd.getDate()),
          dateLabel: `${wd.toLocaleString("en-US", { month: "short" })} ${wd.getDate()} – ${weekEnd.toLocaleString("en-US", { month: "short" })} ${weekEnd.getDate()}`,
          showLabel: thinShowLabel(i, weekStarts.length),
          valueSuffix: " avg/day",
        };
      });
      goalSeconds = settings.dailyGoalSeconds > 0 ? settings.dailyGoalSeconds : null;
      periodTotal = weekStarts.reduce((s, wk) => s + (weekTotal.get(wk) ?? 0), 0);
      const activeWeeks = weekStarts.filter((wk) => (weekTotal.get(wk) ?? 0) > 0);
      unitsWithData = activeWeeks.length;
      averageSeconds = activeWeeks.length > 0
        ? activeWeeks.reduce((s, wk) => s + (weekTotal.get(wk)! / weekDayCount.get(wk)!), 0) / activeWeeks.length
        : 0;
    } else {
      // Same idea as weekly buckets, but grouped by calendar month and
      // averaged over the days of that month that fall inside the range.
      const monthTotal = new Map<string, number>();
      const monthDayCount = new Map<string, number>();
      customDays.forEach((d) => {
        const ym = d.slice(0, 7);
        monthTotal.set(ym, (monthTotal.get(ym) ?? 0) + (totalsByDate[d] ?? 0));
        monthDayCount.set(ym, (monthDayCount.get(ym) ?? 0) + 1);
      });
      const monthKeys = Array.from(monthTotal.keys()).sort();
      bars = monthKeys.map((ym, i) => {
        const [y, m] = ym.split("-").map(Number);
        const total = monthTotal.get(ym) ?? 0;
        const dayCount = monthDayCount.get(ym) ?? 1;
        return {
          key: ym,
          value: total / dayCount,
          label: new Date(y, m - 1, 1).toLocaleString("en-US", { month: "short" }),
          dateLabel: new Date(y, m - 1, 1).toLocaleString("en-US", { month: "short", year: "numeric" }),
          showLabel: thinShowLabel(i, monthKeys.length),
          valueSuffix: " avg/day",
        };
      });
      goalSeconds = settings.dailyGoalSeconds > 0 ? settings.dailyGoalSeconds : null;
      periodTotal = monthKeys.reduce((s, ym) => s + (monthTotal.get(ym) ?? 0), 0);
      const activeMonths = monthKeys.filter((ym) => (monthTotal.get(ym) ?? 0) > 0);
      unitsWithData = activeMonths.length;
      averageSeconds = activeMonths.length > 0
        ? activeMonths.reduce((s, ym) => s + (monthTotal.get(ym)! / monthDayCount.get(ym)!), 0) / activeMonths.length
        : 0;
    }
  }

  // Whole-period entries (not just the selected day) — feeds the per-task
  // breakdown table below, which shares the same period filter as the chart.
  const periodEntries = period === "month"
    ? completed.filter((e) => monthDays.includes(e.date))
    : period === "year"
    ? completed.filter((e) => e.date.startsWith(String(pointerDate.getFullYear())))
    : completed.filter((e) => customDays.includes(e.date));

  // Amounts are summed from each entry's own hourlyRateSnapshot, not a flat
  // rate — rate lives per-client now (see Client in db.ts), so entries
  // tracked under different clients (or at a rate later changed) never
  // shared a single number to begin with.
  const periodAmount = periodEntries.reduce((s, e) => s + ((e.durationSeconds ?? 0) / 3600) * (e.hourlyRateSnapshot ?? 0), 0);
  const averageAmount = unitsWithData > 0 ? periodAmount / unitsWithData : 0;

  const taskBreakdown = (() => {
    const map: Record<string, { name: string; seconds: number; amount: number }> = {};
    periodEntries.forEach((e) => {
      if (!map[e.taskId]) map[e.taskId] = { name: e.taskNameSnapshot, seconds: 0, amount: 0 };
      map[e.taskId].seconds += e.durationSeconds ?? 0;
      map[e.taskId].amount += ((e.durationSeconds ?? 0) / 3600) * (e.hourlyRateSnapshot ?? 0);
    });
    return Object.entries(map)
      .map(([id, t]) => ({ id, ...t }))
      .sort((a, b) => b.seconds - a.seconds);
  })();

  const handleCopyReport = async () => {
    let text: string;
    if (period === "month") {
      const ym = pointerDate.getFullYear() + "-" + String(pointerDate.getMonth() + 1).padStart(2, "0");
      text = buildMonthlyReportText(completed.filter((e) => e.date.slice(0, 7) === ym), formatMonthDateRange(ym), {
        currency: settings.currency, roundReportMinutes: settings.roundReportMinutes,
      });
    } else if (period === "year") {
      const y = String(pointerDate.getFullYear());
      text = buildMonthlyReportText(completed.filter((e) => e.date.startsWith(y)), y, {
        currency: settings.currency, roundReportMinutes: settings.roundReportMinutes,
      });
    } else {
      text = buildMonthlyReportText(completed.filter((e) => customDays.includes(e.date)), reportRangeLabel, {
        currency: settings.currency, roundReportMinutes: settings.roundReportMinutes,
      });
    }
    await copyTextToClipboard(text);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastVisible(true);
    toastTimerRef.current = setTimeout(() => setToastVisible(false), 2000);
  };

  const segments: { key: Period; label: string }[] = [
    { key: "month", label: "Month" },
    { key: "year", label: "Year" },
    { key: "custom", label: "Custom" },
  ];
  const activeIdx = segments.findIndex((s) => s.key === period);

  const ChevronBtn = ({ dir, onClick }: { dir: "left" | "right"; onClick: () => void }) => (
    <button onClick={onClick} style={{ background: "none", border: "none", padding: 4, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d={dir === "left" ? "M10 3L5 8L10 13" : "M6 3L11 8L6 13"} stroke={colors.textPrimary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );

  return (
    <div style={{ width: 440, height: "100vh", background: colors.pageBg, display: "flex", flexDirection: "column", overflow: "hidden", boxSizing: "border-box", position: "relative" }}>
      <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", background: "#181A2C", color: "white", borderRadius: 8, padding: "8px 16px", fontSize: 14, fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap", zIndex: 999, pointerEvents: "none", opacity: toastVisible ? 1 : 0, transition: "opacity 0.25s ease" }}>
        Report copied
      </div>
      <TitleBarSpacer />

      {/* Heading */}
      <div style={{ flexShrink: 0, padding: "24px 24px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: 20, color: colors.textPrimary }}>Statistics</span>
        <button onClick={onClose} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6L18 18" stroke={colors.textPrimary} strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px 84px" }}>

        {/* Period tabs (left) + period selector (right) share one row —
            saves the vertical space the two used to take stacked. The
            segmented control is sized to its own content (fixed per-segment
            width) instead of stretching full-width, since it now shares the
            row with the navigator/date-range picker. */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          {/* Segmented control — styled after macOS NSSegmentedControl: a
              flat track, an elevated chip for the active segment, and thin
              dividers only between two segments that are both inactive. */}
          <div style={{ position: "relative", height: 32, background: colors.cardBg, borderRadius: 7, padding: 2, boxSizing: "border-box", display: "flex", flexShrink: 0 }}>
            <div style={{
              position: "absolute", top: 2, bottom: 2, left: activeIdx * SEGMENT_W + 4,
              width: SEGMENT_W - 4, background: colors.inputBg, borderRadius: 6,
              boxShadow: "0px 1px 2px rgba(0,0,0,0.15)", transition: "left 0.2s ease",
            }} />
            {segments.map((s, i) => (
              <div key={s.key} onClick={() => switchPeriod(s.key)} style={{ position: "relative", width: SEGMENT_W, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 1 }}>
                {i > 0 && activeIdx !== i && activeIdx !== i - 1 && (
                  <div style={{ position: "absolute", left: 0, top: 6, bottom: 6, width: 1, background: colors.border }} />
                )}
                <span style={{ fontSize: 13, fontWeight: 500, color: colors.textPrimary, fontFamily: "'Inter', sans-serif" }}>{s.label}</span>
              </div>
            ))}
          </div>

          {/* Month/Year get the chevron nav; Custom swaps it for a compact
              Start/End date range picker (no calendar icon — there's not
              enough width left next to the tabs for it). */}
          {period === "custom" ? (
            <div style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0 }}>
              {[
                { key: "start", value: customStart, onChange: handleCustomStartChange, max: customEnd || undefined, min: undefined as string | undefined },
                { key: "end", value: customEnd, onChange: handleCustomEndChange, max: toDateStr(new Date()), min: customStart || undefined },
              ].map((field, i) => (
                <Fragment key={field.key}>
                  {i === 1 && <div style={{ width: 8, height: 1, backgroundColor: colors.border, flexShrink: 0, marginLeft: 4, marginRight: 4 }} />}
                  <div style={{ flex: 1, minWidth: 0, position: "relative" }}>
                    <div style={{
                      height: 32, background: colors.inputBg, border: `1px solid ${colors.border}`, borderRadius: 8,
                      display: "flex", alignItems: "center", justifyContent: "center", padding: "0 6px",
                      boxSizing: "border-box", pointerEvents: "none",
                    }}>
                      <span style={{ fontSize: 15, color: colors.textPrimary, fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap" }}>{formatDateDisplay(field.value) || "Select"}</span>
                    </div>
                    <input
                      type="date"
                      value={field.value}
                      max={field.max}
                      min={field.min}
                      onChange={(e) => field.onChange(e.target.value)}
                      style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }}
                    />
                  </div>
                </Fragment>
              ))}
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <ChevronBtn dir="left" onClick={() => shiftPeriod(-1)} />
              <span style={{ width: 72, flexShrink: 0, textAlign: "center", fontSize: 15, fontWeight: 500, color: colors.textPrimary, fontVariantNumeric: "tabular-nums", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap" }}>{navLabel}</span>
              <ChevronBtn dir="right" onClick={() => shiftPeriod(1)} />
            </div>
          )}
        </div>

        {/* Chart */}
        <div style={{ marginTop: 8 }}>
          <BarChart bars={bars} goalSeconds={goalSeconds} colors={colors} />
        </div>

        {/* Always "Daily average" — even in Custom's weekly/monthly bucket
            modes, the number itself is already a per-day average (see the
            bar-value comments above), so the label never changes. */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0" }}>
          <span style={{ fontSize: 15, color: colors.textPrimary, lineHeight: "24px" }}>Daily average</span>
          <span style={{ fontSize: 15, color: colors.textPrimary, lineHeight: "24px", fontVariantNumeric: "tabular-nums", fontFamily: "'Inter', sans-serif" }}>{formatTimeRU(Math.round(averageSeconds))} · {formatAmount(averageAmount, settings.currency)}</span>
        </div>

        {/* Per-task breakdown for the whole selected period (week/month/year
            — same filter as the chart above), sorted by time descending. */}
        <div style={{ width: 392, boxSizing: "border-box", marginTop: 12, borderTop: `1px solid ${colors.border}`, paddingTop: 10, paddingBottom: 10, display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontSize: 15, color: colors.textPrimary, lineHeight: "24px" }}>Breakdown</div>
          {taskBreakdown.length === 0 && (
            <div style={{ padding: "2px 0 4px", color: colors.textSecondary, fontSize: 13 }}>No entries</div>
          )}
          {taskBreakdown.map((t) => (
            <div key={t.id} style={{ padding: "2px 0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontSize: 13, color: colors.textPrimary, lineHeight: "18px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>{t.name}</span>
              <span style={{ fontSize: 13, color: colors.textPrimary, lineHeight: "18px", fontVariantNumeric: "tabular-nums", flexShrink: 0, width: BREAKDOWN_HOURS_W, textAlign: "right", whiteSpace: "nowrap", fontFamily: "'Inter', sans-serif" }}>{formatTimeRU(t.seconds)}</span>
              <span style={{ fontSize: 13, color: colors.textSecondary, lineHeight: "18px", fontVariantNumeric: "tabular-nums", flexShrink: 0, width: BREAKDOWN_MONEY_W, textAlign: "right", whiteSpace: "nowrap", fontFamily: "'Inter', sans-serif" }}>{formatAmount(t.amount, settings.currency)}</span>
            </div>
          ))}
          {taskBreakdown.length > 0 && (
            <div style={{ borderTop: `1px solid ${colors.border}`, marginTop: 2, paddingTop: 6, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontSize: 15, color: colors.textPrimary, lineHeight: "24px", flex: 1, minWidth: 0 }}>Total</span>
              <span style={{ fontSize: 15, color: colors.textPrimary, lineHeight: "24px", fontVariantNumeric: "tabular-nums", flexShrink: 0, width: BREAKDOWN_HOURS_W, textAlign: "right", whiteSpace: "nowrap", fontFamily: "'Inter', sans-serif" }}>{formatTimeRU(periodTotal)}</span>
              <span style={{ fontSize: 15, color: colors.textPrimary, lineHeight: "24px", fontVariantNumeric: "tabular-nums", flexShrink: 0, width: BREAKDOWN_MONEY_W, textAlign: "right", whiteSpace: "nowrap", fontFamily: "'Inter', sans-serif" }}>{formatAmount(periodAmount, settings.currency)}</span>
            </div>
          )}
        </div>
      </div>

      <ButtonBar hideCancel saveLabel={`Copy report ${reportRangeLabel}`} onCancel={onClose} onSave={handleCopyReport} />
    </div>
  );
}
