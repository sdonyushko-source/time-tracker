import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize } from "@tauri-apps/api/dpi";
import Timer from "./components/Timer";
import Today from "./components/Today";
import Summary from "./components/Summary";

export default function App() {
  const [isActive, setIsActive] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [isActive]);

  useEffect(() => {
    const appWindow = getCurrentWindow();
    appWindow.setSize(new LogicalSize(440, isExpanded ? 520 : 120));
  }, [isExpanded]);

  const handleToggle = () => {
    if (isActive) {
      setIsActive(false);
      setElapsedSeconds(0);
    } else {
      setIsActive(true);
    }
  };

  return (
    <div style={{
      width: 440,
      background: "#FFFFFF",
      fontFamily: "'Inter', sans-serif",
      position: "relative",
    }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: 440, height: 80 }}>
        <Timer isActive={isActive} elapsedSeconds={elapsedSeconds} onToggle={handleToggle} />
      </div>

      <div style={{ height: 80 }} />

      {isExpanded && (
        <div style={{ padding: "8px 24px 0" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Today />
            <Summary />
          </div>
        </div>
      )}

      <div
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          width: "100%",
          height: 24,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          marginTop: 0,
        }}
      >
        <div style={{ width: 48, height: 4, borderRadius: 5, background: "#E3E5EA" }} />
      </div>
    </div>
  );
}
