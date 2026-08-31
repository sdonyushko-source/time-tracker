import { Fragment, ReactNode } from "react";
import { useTheme } from "../ThemeContext";
import { formatTimeRU } from "../utils";

const GREEN_GRADIENT = "linear-gradient(176deg, #8FD75F 24.6%, #31D877 69.3%)";
const ORANGE_GRADIENT = "linear-gradient(176deg, #FF7552 24.6%, #FF5125 69.3%)";

interface GoalTooltipContentProps {
  closedSeconds: number;
  runningSeconds: number;
  goalSeconds: number;
  isActive: boolean;
  dailyGoalEnabled: boolean;
}

function Chip({ background, ghost }: { background: string; ghost?: boolean }) {
  return <span style={{ width: 22, height: 8, borderRadius: 40, flexShrink: 0, background, opacity: ghost ? 0.55 : 1 }} />;
}

// Numeric breakdown for the daily-goal progress bar's Tooltip, reused by
// TodaySection and CompactProgress. A 3-column grid (chip / label / value)
// right-aligns the value column without the bubble needing a fixed width —
// Tooltip.tsx shrinks it to content either way.
export default function GoalTooltipContent({ closedSeconds, runningSeconds, goalSeconds, isActive, dailyGoalEnabled }: GoalTooltipContentProps) {
  const { colors } = useTheme();
  const total = closedSeconds + runningSeconds;
  const overSeconds = Math.max(0, total - goalSeconds);
  const leftSeconds = Math.max(0, goalSeconds - total);

  const rows: { chip: ReactNode; label: string; value: string }[] = [
    { chip: <Chip background={GREEN_GRADIENT} />, label: "Tracked", value: formatTimeRU(closedSeconds) },
  ];
  if (isActive) {
    rows.push({ chip: <Chip background={GREEN_GRADIENT} ghost />, label: "Running now", value: formatTimeRU(runningSeconds) });
  }
  if (total > goalSeconds) {
    rows.push({ chip: <Chip background={ORANGE_GRADIENT} ghost />, label: "Over goal", value: formatTimeRU(overSeconds) });
  }
  if (total < goalSeconds && dailyGoalEnabled) {
    rows.push({ chip: <Chip background={colors.progressTrack} />, label: "Left", value: formatTimeRU(leftSeconds) });
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "auto auto auto", alignItems: "center", columnGap: 8, rowGap: 4 }}>
      {rows.map((row) => (
        <Fragment key={row.label}>
          {row.chip}
          <span>{row.label}</span>
          <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{row.value}</span>
        </Fragment>
      ))}
    </div>
  );
}
