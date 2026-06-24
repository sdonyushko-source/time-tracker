import { useState } from "react";

const CopyIcon = () => (
  <img src="https://www.figma.com/api/mcp/asset/bc8fc0fa-5ac7-41b2-9a71-ebd1bb5c512b" style={{ width: 24, height: 24 }} />
);

const HistoryIcon = () => (
  <div style={{ position: "relative", width: 24, height: 24 }}>
    <img src="https://www.figma.com/api/mcp/asset/73716033-24ec-4a44-b33d-b93084279b4c" style={{ position: "absolute", top: 9, left: 12, width: 4, height: 9 }} />
    <img src="https://www.figma.com/api/mcp/asset/7305b088-cbf3-4d39-849c-e92ea81603df" style={{ position: "absolute", top: 2, left: 12, width: 10, height: 17 }} />
    <img src="https://www.figma.com/api/mcp/asset/bae7ddc0-2d3e-49b4-b4cf-0d1d0708fed1" style={{ position: "absolute", top: 2, left: 2, width: 17, height: 20 }} />
  </div>
);

const SettingsIcon = () => (
  <img src="https://www.figma.com/api/mcp/asset/f9338c2c-f878-4ae1-b6f9-34b91bc973fe" style={{ width: 18, height: 15, margin: "4px 3px" }} />
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
