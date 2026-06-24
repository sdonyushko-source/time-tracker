import { useState } from "react";

const CopyIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <rect x="8" y="8" width="13" height="13" rx="2" stroke="#181A2C" strokeWidth="1.5"/>
    <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" stroke="#181A2C" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const HistoryIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="9" stroke="#181A2C" strokeWidth="1.5"/>
    <path d="M12 7v5l3 3" stroke="#181A2C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M3 12H1m3.22-6.78L3 4M12 1V3" stroke="#181A2C" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const SettingsIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <line x1="3" y1="6" x2="21" y2="6" stroke="#181A2C" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="3" y1="12" x2="21" y2="12" stroke="#181A2C" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="3" y1="18" x2="21" y2="18" stroke="#181A2C" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="7" cy="6" r="2" fill="white" stroke="#181A2C" strokeWidth="1.5"/>
    <circle cx="17" cy="12" r="2" fill="white" stroke="#181A2C" strokeWidth="1.5"/>
    <circle cx="10" cy="18" r="2" fill="white" stroke="#181A2C" strokeWidth="1.5"/>
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
