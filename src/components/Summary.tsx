import { TimeEntry, Settings } from "../db";
import { formatTime, formatAmount } from "../utils";

interface SummaryProps {
  todayEntries: TimeEntry[];
  weekEntries: TimeEntry[];
  monthEntries: TimeEntry[];
  settings: Settings;
  liveSeconds: number;
}

function sumSeconds(entries: TimeEntry[]): number {
  return entries.reduce((s, e) => s + (e.durationSeconds ?? 0), 0);
}

export default function Summary({ todayEntries, weekEntries, monthEntries, settings, liveSeconds }: SummaryProps) {
  const todaySec = sumSeconds(todayEntries) + liveSeconds;
  const weekSec = sumSeconds(weekEntries) + liveSeconds;
  const monthSec = sumSeconds(monthEntries) + liveSeconds;
  const rate = settings.hourlyRate;
  const currency = settings.currency;

  const rows = [
    { label: "Today",      seconds: todaySec,  amount: (todaySec  / 3600) * rate, bold: false },
    { label: "This week",  seconds: weekSec,   amount: (weekSec   / 3600) * rate, bold: false },
    { label: "This month", seconds: monthSec,  amount: (monthSec  / 3600) * rate, bold: true  },
  ];

  return (
    <div style={{
      background: "#F6F6F6",
      borderRadius: 12,
      padding: "12px 16px",
      display: "flex",
      flexDirection: "column",
      gap: 8,
      width: 392,
    }}>
      {rows.map((row) => (
        <div key={row.label} style={{
          display: "flex",
          alignItems: "center",
          gap: 24,
          fontSize: 16,
          color: "#181A2C",
          lineHeight: "24px",
          fontWeight: row.bold ? 500 : 400,
        }}>
          <span style={{ width: 111, flexShrink: 0 }}>
            {row.label}
          </span>
          <span style={{
            width: 102,
            flexShrink: 0,
            textAlign: "right",
            fontVariantNumeric: "tabular-nums",
            fontFamily: "'Inter', sans-serif",
          }}>
            {formatTime(row.seconds)}
          </span>
          <span style={{ width: 99, flexShrink: 0, textAlign: "right" }}>
            {formatAmount(row.amount, currency)}
          </span>
        </div>
      ))}
    </div>
  );
}
