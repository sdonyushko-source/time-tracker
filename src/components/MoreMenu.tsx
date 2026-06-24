import { useState } from "react";

const CopyIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16.9832 16.9832C16.9371 18.5468 16.7649 19.4777 16.1213 20.1213C15.2426 21 13.8284 21 11 21H9C6.17157 21 4.75736 21 3.87868 20.1213C3 19.2426 3 17.8284 3 15V13C3 10.1716 3 8.75736 3.87868 7.87868C4.52229 7.23507 5.45324 7.06288 7.01682 7.01682C7.58789 7 8.24334 7 9 7H11C13.8284 7 15.2426 7 16.1213 7.87868C17 8.75736 17 10.1716 17 13V15C17 15.7567 17 16.4121 16.9832 16.9832ZM7.01682 7.01682C7.06288 5.45324 7.23507 4.52229 7.87868 3.87868C8.75736 3 10.1716 3 13 3H15C17.8284 3 19.2426 3 20.1213 3.87868C21 4.75736 21 6.17157 21 9V11C21 13.8284 21 15.2426 20.1213 16.1213C19.4777 16.7649 18.5468 16.9371 16.9832 16.9832" stroke="#181A2C" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const HistoryIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 6V12L16 15" stroke="#181A2C" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M12 22C17.5228 22 22 17.5229 22 12C22 9.2386 20.8807 6.7386 19.0711 4.92896" stroke="#181A2C" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="1 3"/>
    <path d="M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C14.7614 2 17.2614 3.11929 19.0711 4.92893" stroke="#181A2C" strokeWidth="1.5"/>
  </svg>
);

const SettingsIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M18 7.44995C18 9.10681 16.6569 10.45 15 10.45C13.3431 10.45 12 9.10681 12 7.44995M18 7.44995C18 5.7931 16.6569 4.44995 15 4.44995C13.3431 4.44995 12 5.7931 12 7.44995M18 7.44995H21M12 7.44995H3M6 16.45C6 18.1068 7.34315 19.45 9 19.45C10.6569 19.45 12 18.1068 12 16.45M6 16.45C6 14.7931 7.34315 13.45 9 13.45C10.6569 13.45 12 14.7931 12 16.45M6 16.45H3M12 16.45H21" stroke="#181A2C" strokeWidth="1.5" strokeLinecap="round"/>
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
    { key: "copy",     icon: <CopyIcon />,     label: "Copy monthly report", action: onCopyReport },
    { key: "history",  icon: <HistoryIcon />,  label: "Show history",        action: onHistory },
    { key: "settings", icon: <SettingsIcon />, label: "Settings",            action: onSettings },
  ];

  if (!showMenu) return null;

  return (
    <div style={{
      position: "absolute",
      top: 56,
      right: 16,
      background: "white",
      borderRadius: 8,
      padding: 8,
      boxShadow: "0px 8px 12px rgba(24,26,44,0.12)",
      zIndex: 200,
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
            fontFamily: "'Inter', sans-serif",
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
