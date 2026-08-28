import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTheme } from "../ThemeContext";
import Tooltip from "./Tooltip";

interface TitleBarButtonsProps {
  isCompact: boolean;
  onToggleView: () => void;
  focusActive: boolean;
  focusStartedAtMs: number | null;
  focusDurationMs: number;
  // Icon only shows once this is > 0 ("Off" in Settings otherwise).
  focusMinutes: number;
  onFocusToggle: () => void;
}

// Height of the macOS overlay title bar strip (see tauri.conf.json
// titleBarStyle: "Overlay") that the traffic lights float over. Not exposed
// by the OS/Tauri, so this mirrors the same 31px figure used elsewhere in
// the app for that area.
export const TITLEBAR_HEIGHT = 31;

const CollapseIcon = ({ color }: { color: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M6.63726 13.1209L9.8799 13.1209C10.156 13.1209 10.406 13.2328 10.587 13.4138M10.8799 17.3635L10.8799 14.1209C10.8799 13.8447 10.768 13.5948 10.587 13.4138M10.587 13.4138L6.69805 17.3M17.3652 10.8783L14.1225 10.8783C13.8464 10.8783 13.5964 10.7663 13.4154 10.5854M13.1225 6.63561L13.1225 9.87825C13.1225 10.1544 13.2345 10.4044 13.4154 10.5854M13.4154 10.5854L17.3031 6.69489" stroke={color} strokeWidth="1.5" strokeLinecap="round" style={{ transition: "stroke 0.1s ease" }} />
  </svg>
);

const ExpandIcon = ({ color }: { color: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M17.5974 10.646L17.5974 7.40338C17.5974 7.12724 17.4855 6.87724 17.3045 6.69627M13.3548 6.40338L16.5974 6.40338C16.8736 6.40338 17.1236 6.51531 17.3045 6.69627M17.3045 6.69627L13.414 10.584M6.40653 13.3516L6.40653 16.5943C6.40653 16.8704 6.51846 17.1204 6.69943 17.3014M10.6492 17.5943L7.40653 17.5943C7.13039 17.5943 6.88039 17.4823 6.69943 17.3014M6.69943 17.3014L10.5856 13.4124" stroke={color} strokeWidth="1.5" strokeLinecap="round" style={{ transition: "stroke 0.1s ease" }} />
  </svg>
);

const ClockIcon = ({ color }: { color: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="7.25" stroke={color} strokeWidth="1.5" style={{ transition: "stroke 0.1s ease" }} />
    <path d="M12 8V12L14.5 13.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: "stroke 0.1s ease" }} />
  </svg>
);

const ThreeDotsIcon = ({ color }: { color: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M6 8H18M6 12H18M6 16H18" stroke={color} strokeWidth="1.5" strokeLinecap="round" style={{ transition: "stroke 0.1s ease" }} />
  </svg>
);

// Lives in the overlay title bar strip, to the right of the native
// close/miniaturize dots — Collapse/Expand (16px to the left of) and the
// "..." menu button that used to sit in the Timer row itself.
export default function TitleBarButtons({ isCompact, onToggleView, focusActive, focusStartedAtMs, focusDurationMs, focusMinutes, onFocusToggle }: TitleBarButtonsProps) {
  const { colors } = useTheme();
  const [toggleHovered, setToggleHovered] = useState(false);
  const [menuHovered, setMenuHovered] = useState(false);
  const [focusHovered, setFocusHovered] = useState(false);

  // Recomputed from wall-clock time on every render (App re-renders this
  // once a second while a cycle is running) rather than decremented — same
  // reasoning as the ring in Timer.tsx: a throttled render just shows a
  // stale number a moment late, it never drifts.
  const focusTooltip = focusActive && focusStartedAtMs !== null
    ? `${Math.max(0, Math.ceil((focusDurationMs - (Date.now() - focusStartedAtMs)) / 60000))} min left`
    : `Start ${focusMinutes} min focus`;

  return (
    <div
      data-tauri-drag-region
      style={{
        height: TITLEBAR_HEIGHT,
        flexShrink: 0,
        width: "100%",
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 8,
        paddingRight: 8,
        marginBottom: 8,
      }}
    >
      {focusMinutes > 0 && (
        <Tooltip content={focusTooltip}>
          <button
            onClick={onFocusToggle}
            onMouseEnter={() => setFocusHovered(true)}
            onMouseLeave={() => setFocusHovered(false)}
            style={{ width: 24, height: 24, background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <ClockIcon color={focusActive || focusHovered ? "#7381D3" : colors.textPrimary} />
          </button>
        </Tooltip>
      )}
      <button
        onClick={onToggleView}
        onMouseEnter={() => setToggleHovered(true)}
        onMouseLeave={() => setToggleHovered(false)}
        style={{ width: 24, height: 24, background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        {isCompact ? (
          <ExpandIcon color={toggleHovered ? "#7381D3" : colors.textPrimary} />
        ) : (
          <CollapseIcon color={toggleHovered ? "#7381D3" : colors.textPrimary} />
        )}
      </button>
      <button
        onClick={() => invoke("show_more_menu")}
        onMouseEnter={() => setMenuHovered(true)}
        onMouseLeave={() => setMenuHovered(false)}
        style={{ width: 24, height: 24, background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <ThreeDotsIcon color={menuHovered ? "#7381D3" : colors.textPrimary} />
      </button>
    </div>
  );
}
