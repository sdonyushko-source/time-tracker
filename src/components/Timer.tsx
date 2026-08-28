import { useState } from "react";
import { Task } from "../db";
import TaskPicker, { TaskPickerGroup } from "./TaskPicker";
import { useTheme } from "../ThemeContext";

interface TimerProps {
  isActive: boolean;
  elapsedSeconds: number;
  onToggle: () => void;
  onTimeClick?: () => void;
  tasks: Task[];
  clientGroups?: TaskPickerGroup[] | null;
  selectedTaskId: string;
  onTaskSelect: (id: string) => void;
  focusActive: boolean;
  focusStartedAtMs: number | null;
  focusDurationMs: number;
}

// Ring circumference for r=27 (see FocusRing below) — stroke-dasharray needs
// this to turn a 0..1 progress fraction into an arc length.
const FOCUS_RING_CIRCUMFERENCE = 2 * Math.PI * 27;

function FocusRing({ pct, colors }: { pct: number; colors: { border: string; textSecondary: string } }) {
  const dash = FOCUS_RING_CIRCUMFERENCE * pct;
  return (
    <svg
      width="60"
      height="60"
      viewBox="0 0 60 60"
      style={{ position: "absolute", top: -6, left: -6, pointerEvents: "none" }}
    >
      <circle cx="30" cy="30" r="27" fill="none" stroke={colors.border} strokeWidth="2" />
      <circle
        cx="30"
        cy="30"
        r="27"
        fill="none"
        stroke={colors.textSecondary}
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${FOCUS_RING_CIRCUMFERENCE - dash}`}
        transform="rotate(-90 30 30)"
      />
    </svg>
  );
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

const PlaySVG = ({ hovered }: { hovered: boolean }) => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ overflow: "visible" }}>
    <defs>
      <filter id="fp" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="4" stdDeviation="10" floodColor="rgba(33,152,81,0.3)" />
      </filter>
      <linearGradient id="gp" x1="7" y1="7.5" x2="24" y2="48" gradientUnits="userSpaceOnUse">
        <stop stopColor="#8FD75F" />
        <stop offset="1" stopColor={hovered ? "#1ECC67" : "#31D877"} style={{ transition: "stop-color 0.3s ease" }} />
      </linearGradient>
    </defs>
    <circle cx="24" cy="24" r="24" fill="url(#gp)" filter="url(#fp)" />
    <path d="M17 22.886C17 18.076 17 15.671 18.5519 14.8156C20.1038 13.9603 22.1372 15.2445 26.204 17.813L27.9679 18.9271C31.5773 21.2067 33.3819 22.3465 33.3819 24C33.3819 25.6535 31.5773 26.7933 27.9679 29.0729L26.204 30.187C22.1372 32.7555 20.1038 34.0397 18.5519 33.1844C17 32.329 17 29.924 17 25.114V22.886Z" fill="white" />
  </svg>
);

const StopSVG = ({ hovered }: { hovered: boolean }) => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ overflow: "visible" }}>
    <defs>
      <filter id="fs" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="4" stdDeviation="10" floodColor="rgba(153,44,16,0.3)" />
      </filter>
      <linearGradient id="gs" x1="4" y1="7.5" x2="24" y2="48" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FF7552" />
        <stop offset="1" stopColor={hovered ? "#F53505" : "#FF5125"} style={{ transition: "stop-color 0.3s ease" }} />
      </linearGradient>
    </defs>
    <circle cx="24" cy="24" r="24" fill="url(#gs)" filter="url(#fs)" />
    <rect x="15" y="15" width="18" height="18" rx="4" fill="white" />
  </svg>
);

export default function Timer({ isActive, elapsedSeconds, onToggle, onTimeClick, tasks, clientGroups, selectedTaskId, onTaskSelect, focusActive, focusStartedAtMs, focusDurationMs }: TimerProps) {
  const { colors } = useTheme();
  const [taskHovered, setTaskHovered] = useState(false);
  const [playStopHovered, setPlayStopHovered] = useState(false);

  // Derived straight from wall-clock time on every render (App forces a
  // render once a second while a cycle is running) rather than decremented —
  // a throttled/skipped render just shows the ring a moment behind, it can
  // never drift out of sync with the actual deadline.
  const focusPct = focusActive && focusStartedAtMs !== null && focusDurationMs > 0
    ? Math.min(1, Math.max(0, (Date.now() - focusStartedAtMs) / focusDurationMs))
    : 0;

  return (
    // Headroom for the focus ring's 6px overflow above the Play/Stop button
    // (see FocusRing above) is reserved permanently by the full-mode
    // scrollable container's own paddingTop (App.tsx) — not here, so this
    // component's layout never shifts based on focusActive.
    <div style={{ position: "relative", height: 56, width: "100%" }}>
      <div style={{
        position: "absolute",
        left: 24,
        top: 0,
        width: 392,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <TaskPicker
            tasks={tasks}
            clientGroups={clientGroups}
            selectedTaskId={selectedTaskId}
            onSelect={onTaskSelect}
            color={taskHovered ? "#7381D3" : colors.textPrimary}
            onMouseEnter={() => setTaskHovered(true)}
            onMouseLeave={() => setTaskHovered(false)}
          />
          <p
            onClick={isActive && onTimeClick ? onTimeClick : undefined}
            style={{
              width: 90,
              flexShrink: 0,
              fontSize: 20,
              textAlign: "center",
              color: colors.textPrimary,
              fontVariantNumeric: "tabular-nums",
              fontFamily: "'Inter', sans-serif",
              margin: 0,
              cursor: isActive && onTimeClick ? "pointer" : "default",
            }}
          >
            {formatTime(elapsedSeconds)}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <button
            onClick={onToggle}
            onMouseEnter={() => setPlayStopHovered(true)}
            onMouseLeave={() => setPlayStopHovered(false)}
            style={{
              width: 48,
              height: 48,
              flexShrink: 0,
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              overflow: "visible",
              position: "relative",
            }}
          >
            <div style={{ position: "absolute", top: 0, left: 0, opacity: isActive ? 0 : 1, transition: "opacity 0.3s ease", pointerEvents: "none" }}>
              <PlaySVG hovered={playStopHovered} />
            </div>
            <div style={{ position: "absolute", top: 0, left: 0, opacity: isActive ? 1 : 0, transition: "opacity 0.3s ease", pointerEvents: "none" }}>
              <StopSVG hovered={playStopHovered} />
            </div>
            {focusActive && <FocusRing pct={focusPct} colors={colors} />}
          </button>
        </div>
      </div>
    </div>
  );
}
