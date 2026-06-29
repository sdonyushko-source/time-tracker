import { useState } from "react";
import { Task } from "../db";
import TaskPicker from "./TaskPicker";

interface TimerProps {
  isActive: boolean;
  elapsedSeconds: number;
  onToggle: () => void;
  onTimeClick?: () => void;
  tasks: Task[];
  selectedTaskId: string;
  onTaskSelect: (id: string) => void;
  onCopyReport: () => void;
  onHistory: () => void;
  onSettings: () => void;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

const ThreeDotsIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="5" r="1.5" fill="#181A2C"/>
    <circle cx="12" cy="12" r="1.5" fill="#181A2C"/>
    <circle cx="12" cy="19" r="1.5" fill="#181A2C"/>
  </svg>
);

const PlaySVG = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ overflow: "visible" }}>
    <defs>
      <filter id="fp" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="4" stdDeviation="10" floodColor="rgba(33,152,81,0.3)" />
      </filter>
      <linearGradient id="gp" x1="7" y1="7.5" x2="24" y2="48" gradientUnits="userSpaceOnUse">
        <stop stopColor="#8FD75F" />
        <stop offset="1" stopColor="#31D877" />
      </linearGradient>
    </defs>
    <circle cx="24" cy="24" r="24" fill="url(#gp)" filter="url(#fp)" />
    <path d="M17 22.886C17 18.076 17 15.671 18.5519 14.8156C20.1038 13.9603 22.1372 15.2445 26.204 17.813L27.9679 18.9271C31.5773 21.2067 33.3819 22.3465 33.3819 24C33.3819 25.6535 31.5773 26.7933 27.9679 29.0729L26.204 30.187C22.1372 32.7555 20.1038 34.0397 18.5519 33.1844C17 32.329 17 29.924 17 25.114V22.886Z" fill="white" />
  </svg>
);

const StopSVG = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ overflow: "visible" }}>
    <defs>
      <filter id="fs" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="4" stdDeviation="10" floodColor="rgba(153,44,16,0.3)" />
      </filter>
      <linearGradient id="gs" x1="4" y1="7.5" x2="24" y2="48" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FF7552" />
        <stop offset="1" stopColor="#FF5125" />
      </linearGradient>
    </defs>
    <circle cx="24" cy="24" r="24" fill="url(#gs)" filter="url(#fs)" />
    <rect x="15" y="15" width="18" height="18" rx="4" fill="white" />
  </svg>
);

const CopyIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M16.9832 16.9832C16.9371 18.5468 16.7649 19.4777 16.1213 20.1213C15.2426 21 13.8284 21 11 21H9C6.17157 21 4.75736 21 3.87868 20.1213C3 19.2426 3 17.8284 3 15V13C3 10.1716 3 8.75736 3.87868 7.87868C4.52229 7.23507 5.45324 7.06288 7.01682 7.01682C7.58789 7 8.24334 7 9 7H11C13.8284 7 15.2426 7 16.1213 7.87868C17 8.75736 17 10.1716 17 13V15C17 15.7567 17 16.4121 16.9832 16.9832ZM7.01682 7.01682C7.06288 5.45324 7.23507 4.52229 7.87868 3.87868C8.75736 3 10.1716 3 13 3H15C17.8284 3 19.2426 3 20.1213 3.87868C21 4.75736 21 6.17157 21 9V11C21 13.8284 21 15.2426 20.1213 16.1213C19.4777 16.7649 18.5468 16.9371 16.9832 16.9832" stroke="#181A2C" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const HistoryIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M12 6V12L16 15" stroke="#181A2C" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M12 22C17.5228 22 22 17.5229 22 12C22 9.2386 20.8807 6.7386 19.0711 4.92896" stroke="#181A2C" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="1 3"/>
    <path d="M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C14.7614 2 17.2614 3.11929 19.0711 4.92893" stroke="#181A2C" strokeWidth="1.5"/>
  </svg>
);

const SettingsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M18 7.44995C18 9.10681 16.6569 10.45 15 10.45C13.3431 10.45 12 9.10681 12 7.44995M18 7.44995C18 5.7931 16.6569 4.44995 15 4.44995C13.3431 4.44995 12 5.7931 12 7.44995M18 7.44995H21M12 7.44995H3M6 16.45C6 18.1068 7.34315 19.45 9 19.45C10.6569 19.45 12 18.1068 12 16.45M6 16.45C6 14.7931 7.34315 13.45 9 13.45C10.6569 13.45 12 14.7931 12 16.45M6 16.45H3M12 16.45H21" stroke="#181A2C" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

export default function Timer({ isActive, elapsedSeconds, onToggle, onTimeClick, tasks, selectedTaskId, onTaskSelect, onCopyReport, onHistory, onSettings }: TimerProps) {
  const [taskHovered, setTaskHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const menuItems = [
    { label: "Copy monthly report", icon: <CopyIcon />, action: onCopyReport },
    { label: "Show history", icon: <HistoryIcon />, action: onHistory },
    { label: "Settings", icon: <SettingsIcon />, action: onSettings },
  ];

  return (
    <div style={{ position: "relative", height: 80, width: "100%" }}>
      {menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 98 }}
        />
      )}
      <div style={{
        position: "absolute",
        left: 24,
        top: 16,
        width: 392,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <TaskPicker
            tasks={tasks}
            selectedTaskId={selectedTaskId}
            onSelect={onTaskSelect}
            color={taskHovered ? "#7381D3" : "#181A2C"}
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
              color: "#181A2C",
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
              <PlaySVG />
            </div>
            <div style={{ position: "absolute", top: 0, left: 0, opacity: isActive ? 1 : 0, transition: "opacity 0.3s ease", pointerEvents: "none" }}>
              <StopSVG />
            </div>
          </button>

          <div style={{ position: "relative", width: 24, height: 24, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div
              onClick={() => setMenuOpen(!menuOpen)}
              style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <ThreeDotsIcon />
            </div>
            {menuOpen && (
              <div style={{
                position: "absolute",
                top: 28,
                right: 0,
                background: "#FFFFFF",
                border: "1px solid #E3E5EA",
                borderRadius: 10,
                boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                zIndex: 99,
                minWidth: 210,
                overflow: "hidden",
              }}>
                {menuItems.map((item) => (
                  <div
                    key={item.label}
                    onClick={() => { setMenuOpen(false); item.action(); }}
                    style={{
                      padding: "10px 16px",
                      lineHeight: "18px",
                      fontWeight: 400,
                      fontSize: 14,
                      fontFamily: "'Inter', sans-serif",
                      color: "#181A2C",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#F6F6F6")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    {item.icon}
                    {item.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
