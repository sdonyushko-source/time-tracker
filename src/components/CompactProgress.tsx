import { TimeEntry, Settings } from "../db";
import { formatTimeRU, computeGoalProgress } from "../utils";
import { useTheme } from "../ThemeContext";

interface CompactProgressProps {
  last7Entries: TimeEntry[];
  settings: Settings;
  isActive: boolean;
  // See the same prop on TodaySectionProps — the running entry's live
  // duration, not derivable from last7Entries until it's stopped.
  elapsedSeconds: number;
}

function getLocalDate(): string {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

// The slim bar-and-numbers row shown when the main window is collapsed to
// 126px tall — mirrors the Figma reference: a shorter (not full-width) bar
// sharing its row with the "time / goal · pct%" text, in place of
// TodaySection's separate label row + full-width bar + task list.
export default function CompactProgress({ last7Entries, settings, isActive, elapsedSeconds }: CompactProgressProps) {
  const { colors } = useTheme();
  const today = getLocalDate();
  const { dailyGoalSeconds } = settings;

  const closedSeconds = last7Entries
    .filter((e) => e.date === today && e.endTime)
    .reduce((s, e) => s + (e.durationSeconds ?? 0), 0);
  const runningSeconds = isActive ? elapsedSeconds : 0;
  const { totalSeconds, pct, green: greenPct, ghost: ghostPct, orange: orangePct, ghostOver: ghostOverPct } =
    computeGoalProgress(closedSeconds, runningSeconds, dailyGoalSeconds);

  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      <div style={{ width: 220, boxSizing: "border-box", paddingLeft: 24 }}>
        <div style={{ height: 8, width: "100%", borderRadius: 40, background: colors.progressTrack, overflow: "hidden", display: "flex" }}>
          <div style={{ height: 8, width: `${greenPct}%`, flexShrink: 0, background: "linear-gradient(176deg, #8FD75F 24.6%, #31D877 69.3%)", boxShadow: "0px 4px 20px 0px rgba(33,152,81,0.3)" }} />
          {ghostPct > 0 && (
            <div style={{ height: 8, width: `${ghostPct}%`, flexShrink: 0, opacity: 0.4, background: "linear-gradient(176deg, #8FD75F 24.6%, #31D877 69.3%)" }} />
          )}
          {orangePct > 0 && (
            <div style={{ height: 8, width: `${orangePct}%`, flexShrink: 0, background: "linear-gradient(176deg, #FF7552 24.6%, #FF5125 69.3%)", boxShadow: "0px 4px 20px 0px rgba(153,44,16,0.3)" }} />
          )}
          {ghostOverPct > 0 && (
            <div style={{ height: 8, width: `${ghostOverPct}%`, flexShrink: 0, opacity: 0.4, background: "linear-gradient(176deg, #FF7552 24.6%, #FF5125 69.3%)" }} />
          )}
        </div>
      </div>
      <div style={{ width: 220, boxSizing: "border-box", paddingRight: 24, display: "flex", justifyContent: "flex-end" }}>
        <span style={{ fontSize: 14, color: colors.textPrimary, lineHeight: "24px", fontVariantNumeric: "tabular-nums", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap" }}>
          {formatTimeRU(totalSeconds)} / {formatTimeRU(dailyGoalSeconds)} · {pct}%
        </span>
      </div>
    </div>
  );
}
