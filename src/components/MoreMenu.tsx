import { useState } from "react";

const CopyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="5" y="1" width="10" height="10" rx="2" stroke="#181A2C" strokeWidth="1.5" />
    <rect x="1" y="5" width="10" height="10" rx="2" fill="white" stroke="#181A2C" strokeWidth="1.5" />
  </svg>
);

const HistoryIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="6.5" stroke="#181A2C" strokeWidth="1.5" />
    <path d="M8 4.5V8L10.5 10" stroke="#181A2C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SettingsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M2 4H14M2 8H14M2 12H14" stroke="#181A2C" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="5" cy="4" r="1.5" fill="white" stroke="#181A2C" strokeWidth="1.5" />
    <circle cx="10" cy="8" r="1.5" fill="white" stroke="#181A2C" strokeWidth="1.5" />
    <circle cx="6" cy="12" r="1.5" fill="white" stroke="#181A2C" strokeWidth="1.5" />
  </svg>
);

interface MoreMenuProps {
  showMenu: boolean;
  onCopyReport: () => void;
  onHistory: () => void;
  onSettings: () => void;
}

export default function MoreMenu({ showMenu, onCopyReport, onHistory, onSettings }: MoreMenuProps) {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const items = [
    { key: "copy",     icon: <CopyIcon />,     label: "Copy monthly report.", action: onCopyReport },
    { key: "history",  icon: <HistoryIcon />,  label: "Show history",         action: onHistory },
    { key: "settings", icon: <SettingsIcon />, label: "Settings",             action: onSettings },
  ];

  if (!showMenu) return null;

  return (
    <div style={{
      position: "absolute",
      top: 96,
      right: 8,
      background: "white",
      borderRadius: 8,
      padding: 8,
      boxShadow: "0px 8px 12px rgba(24,26,44,0.12)",
      zIndex: 100,
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-end",
    }}>
      {items.map((item) => (
        <div
          key={item.key}
          onClick={item.action}
          onMouseEnter={() => setHoveredItem(item.key)}
          onMouseLeave={() => setHoveredItem(null)}
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            padding: 8,
            borderRadius: 8,
            width: "100%",
            cursor: "pointer",
            background: hoveredItem === item.key ? "#F6F6F6" : "white",
            boxSizing: "border-box",
          }}
        >
          {item.icon}
          <span style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 14,
            fontWeight: 400,
            lineHeight: "18px",
            color: "#181A2C",
            whiteSpace: "nowrap",
          }}>
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}
