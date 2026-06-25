import { useState, useEffect, useCallback, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize } from "@tauri-apps/api/dpi";
import Timer from "./components/Timer";
import Today from "./components/Today";
import Summary from "./components/Summary";
import MoreMenu from "./components/MoreMenu";
import SettingsScreen from "./components/SettingsScreen";
import EditTimeEntryScreen from "./components/EditTimeEntryScreen";
import { formatTime, formatAmount } from "./utils";
import {
  Settings, Task, TimeEntry,
  initDB, getSettings, getTasks,
  getTodayEntries, getWeekEntries, getMonthEntries,
  startEntry, stopEntry,
} from "./db";

type Screen = "timer" | "settings" | "editTimeEntry";

const DEFAULT_SETTINGS: Settings = { hourlyRate: 30, currency: "USD", dailyGoalSeconds: 21600 };

export default function App() {
  const [screen, setScreen] = useState<Screen>("timer");
  const [isActive, setIsActive] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const startTimeRef = useRef<number | null>(null);

  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const [selectedEditTaskId, setSelectedEditTaskId] = useState("");
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [todayEntries, setTodayEntries] = useState<TimeEntry[]>([]);
  const [weekEntries, setWeekEntries] = useState<TimeEntry[]>([]);
  const [monthEntries, setMonthEntries] = useState<TimeEntry[]>([]);

  useEffect(() => {
    (async () => {
      await initDB();
      const [s, t, today, week, month] = await Promise.all([
        getSettings(), getTasks(), getTodayEntries(), getWeekEntries(), getMonthEntries(),
      ]);
      setSettings(s);
      setTasks(t);
      if (t.length) setSelectedTaskId(t[0].id);
      setTodayEntries(today);
      setWeekEntries(week);
      setMonthEntries(month);
    })();
  }, []);

  useEffect(() => {
    if (!isActive) return;
    startTimeRef.current = Date.now();
    const interval = setInterval(() => {
      if (startTimeRef.current !== null) {
        setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }
    }, 500);
    return () => clearInterval(interval);
  }, [isActive]);

  useEffect(() => {
    const appWindow = getCurrentWindow();
    if (screen === "settings") {
      appWindow.setSize(new LogicalSize(440, 520));
    } else if (screen === "editTimeEntry") {
      const n = todayEntries.filter((e) => e.taskId === selectedEditTaskId).length;
      const h = n <= 1 ? 380 : Math.min(640, 196 + n * 168);
      appWindow.setSize(new LogicalSize(440, h));
    } else {
      appWindow.setSize(new LogicalSize(440, isExpanded ? 620 : 120));
    }
  }, [screen, isExpanded, selectedEditTaskId, todayEntries]);

  const refresh = useCallback(async () => {
    const [today, week, month] = await Promise.all([
      getTodayEntries(), getWeekEntries(), getMonthEntries(),
    ]);
    setTodayEntries(today);
    setWeekEntries(week);
    setMonthEntries(month);
  }, []);

  const loadData = useCallback(async () => {
    const [s, t, today, week, month] = await Promise.all([
      getSettings(), getTasks(), getTodayEntries(), getWeekEntries(), getMonthEntries(),
    ]);
    setSettings(s);
    setTasks(t);
    setSelectedTaskId((prev) => (t.find((task) => task.id === prev) ? prev : t.length ? t[0].id : ""));
    setTodayEntries(today);
    setWeekEntries(week);
    setMonthEntries(month);
  }, []);

  const handleToggle = async () => {
    if (isActive) {
      const elapsed = startTimeRef.current !== null
        ? Math.floor((Date.now() - startTimeRef.current) / 1000)
        : elapsedSeconds;
      if (activeEntryId) {
        await stopEntry(activeEntryId, new Date().toISOString(), elapsed);
        setActiveEntryId(null);
      }
      startTimeRef.current = null;
      setIsActive(false);
      setElapsedSeconds(0);
      await refresh();
    } else {
      if (!selectedTaskId) return;
      const task = tasks.find((t) => t.id === selectedTaskId);
      const id = await startEntry(selectedTaskId, task?.name ?? "", settings.hourlyRate, settings.currency);
      setActiveEntryId(id);
      setIsActive(true);
      await refresh();
    }
  };

  const handleCopyReport = async () => {
    const taskMap: Record<string, { name: string; seconds: number }> = {};
    monthEntries.forEach((e) => {
      if (!taskMap[e.taskId]) taskMap[e.taskId] = { name: e.taskNameSnapshot, seconds: 0 };
      taskMap[e.taskId].seconds += e.durationSeconds ?? 0;
    });

    const now = new Date();
    const header = now.toLocaleString("en-US", { month: "long", year: "numeric" });
    const rate = settings.hourlyRate;
    const currency = settings.currency;

    const lines: string[] = [`Monthly Report — ${header}`, ""];
    let totalSeconds = 0;
    Object.values(taskMap).forEach(({ name, seconds }) => {
      lines.push(`${name}   ${formatTime(seconds)}   ${formatAmount((seconds / 3600) * rate, currency)}`);
      totalSeconds += seconds;
    });
    lines.push("", `Total   ${formatTime(totalSeconds)}   ${formatAmount((totalSeconds / 3600) * rate, currency)}`);

    await navigator.clipboard.writeText(lines.join("\n"));
    setShowMoreMenu(false);
  };

  if (screen === "settings") {
    return (
      <SettingsScreen
        onClose={() => { setScreen("timer"); loadData(); }}
        onSave={() => { setScreen("timer"); loadData(); }}
      />
    );
  }

  if (screen === "editTimeEntry") {
    return (
      <EditTimeEntryScreen
        entries={todayEntries.filter((e) => e.taskId === selectedEditTaskId)}
        tasks={tasks}
        onClose={() => { setScreen("timer"); loadData(); }}
      />
    );
  }

  return (
    <div style={{
      width: 440,
      background: "#FFFFFF",
      fontFamily: "'Inter', sans-serif",
      position: "relative",
    }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: 440, height: 80 }}>
        <Timer
          isActive={isActive}
          elapsedSeconds={elapsedSeconds}
          onToggle={handleToggle}
          tasks={tasks}
          selectedTaskId={selectedTaskId}
          onTaskSelect={(id) => setSelectedTaskId(id)}
          onMoreClick={() => setShowMoreMenu(!showMoreMenu)}
        />
      </div>

      <div style={{ height: 80 }} />

      {isExpanded && (
        <div style={{ padding: "8px 24px 0" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Today
              entries={todayEntries}
              settings={settings}
              dailyGoalSeconds={settings.dailyGoalSeconds}
              onTaskClick={(taskId) => { setSelectedEditTaskId(taskId); setScreen("editTimeEntry"); }}
            />
            <Summary
              todayEntries={todayEntries}
              weekEntries={weekEntries}
              monthEntries={monthEntries}
              settings={settings}
            />
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

      {showMoreMenu && (
        <div
          onClick={() => setShowMoreMenu(false)}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }}
        />
      )}
      <MoreMenu
        showMenu={showMoreMenu}
        onCopyReport={handleCopyReport}
        onHistory={() => alert("History coming soon")}
        onSettings={() => { setShowMoreMenu(false); setScreen("settings"); }}
      />
    </div>
  );
}
