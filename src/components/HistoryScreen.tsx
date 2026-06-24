import { TimeEntry } from "../db";
import { formatTime, formatAmount } from "../utils";

interface HistoryScreenProps {
  entries: TimeEntry[];
  currency: string;
  hourlyRate: number;
}

function formatDate(dateStr: string): string {
  const [, month, day] = dateStr.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(month) - 1]} ${parseInt(day)}`;
}

function formatClock(isoStr: string): string {
  return new Date(isoStr).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function HistoryScreen({ entries, currency, hourlyRate }: HistoryScreenProps) {
  if (!entries.length) {
    return (
      <div style={{
        padding: "0 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 120,
      }}>
        <span style={{ fontSize: 16, color: "#908F8F", fontFamily: "'DM Sans', sans-serif" }}>
          No entries yet
        </span>
      </div>
    );
  }

  // Group by date
  const grouped: Record<string, TimeEntry[]> = {};
  entries.forEach((e) => {
    if (!grouped[e.date]) grouped[e.date] = [];
    grouped[e.date].push(e);
  });
  const dates = Object.keys(grouped).sort().reverse();

  return (
    <div style={{
      padding: "0 24px",
      display: "flex",
      flexDirection: "column",
      gap: 16,
      overflowY: "auto",
      maxHeight: 348,
    }}>
      <span style={{ fontSize: 16, fontWeight: 500, color: "#181A2C", fontFamily: "'DM Sans', sans-serif" }}>
        History
      </span>

      {dates.map((date) => {
        const dayEntries = grouped[date];
        const dayTotal = dayEntries.reduce((s, e) => s + (e.durationSeconds ?? 0), 0);

        return (
          <div key={date} style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {/* Date header */}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingBottom: 8,
            }}>
              <span style={{ fontSize: 14, color: "#908F8F", fontFamily: "'DM Sans', sans-serif" }}>
                {formatDate(date)}
              </span>
              <div style={{ display: "flex", gap: 12 }}>
                <span style={{
                  fontSize: 14,
                  color: "#908F8F",
                  fontFamily: "'DM Sans', sans-serif",
                  fontVariantNumeric: "tabular-nums",
                }}>
                  {formatTime(dayTotal)}
                </span>
                <span style={{ fontSize: 14, color: "#908F8F", fontFamily: "'DM Sans', sans-serif" }}>
                  {formatAmount((dayTotal / 3600) * hourlyRate, currency)}
                </span>
              </div>
            </div>

            {/* Entries */}
            {dayEntries.map((entry) => (
              <div
                key={entry.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 0",
                  borderTop: "1px solid #E3E5EA",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{
                    fontSize: 14,
                    color: "#181A2C",
                    fontFamily: "'DM Sans', sans-serif",
                    lineHeight: "20px",
                  }}>
                    {entry.taskNameSnapshot}
                  </span>
                  <span style={{ fontSize: 12, color: "#908F8F", fontFamily: "'DM Sans', sans-serif" }}>
                    {formatClock(entry.startTime)}
                    {entry.endTime ? ` – ${formatClock(entry.endTime)}` : ""}
                  </span>
                </div>
                <span style={{
                  fontSize: 14,
                  color: "#181A2C",
                  fontFamily: "'DM Sans', sans-serif",
                  fontVariantNumeric: "tabular-nums",
                }}>
                  {formatTime(entry.durationSeconds ?? 0)}
                </span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
