import { useState, useEffect, useCallback } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize } from "@tauri-apps/api/dpi";
import Timer from "./components/Timer";
import Today from "./components/Today";
import Summary from "./components/Summary";
import TaskPicker from "./components/TaskPicker";
import {
  Settings, Task, TimeEntry,
  initDB, getSettings, getTasks,
  getTodayEntries, getWeekEntries, getMonthEntries,
  startEntry, stopEntry,
} from "./db";

const DEFAULT_SETTINGS: Settings = { hourlyRate: 30, currency: "USD", dailyGoalSeconds: 21600 };

export default function App() {
  const [isActive, setIsActive] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const [showTaskPicker, setShowTaskPicker] = useState(false);
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
    const interval = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [isActive]);

  useEffect(() => {
    const appWindow = getCurrentWindow();
    appWindow.setSize(new LogicalSize(440, isExpanded ? 520 : 120));
  }, [isExpanded]);

  const refresh = useCallback(async () => {
    const [today, week, month] = await Promise.all([
      getTodayEntries(), getWeekEntries(), getMonthEntries(),
    ]);
    setTodayEntries(today);
    setWeekEntries(week);
    setMonthEntries(month);
  }, []);

  const handleToggle = async () => {
    if (isActive) {
      if (activeEntryId) {
        await stopEntry(activeEntryId, new Date().toISOString(), elapsedSeconds);
        setActiveEntryId(null);
      }
      setIsActive(false);
      setElapsedSeconds(0);
      await refresh();
    } else {
      if (!selectedTaskId) return;
      const task = tasks.find((t) => t.id === selectedTaskId);
      const id = await startEntry(selectedTaskId, task?.name ?? "", settings.hourlyRate, settings.currency);
      setActiveEntryId(id);
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
        <Timer
          isActive={isActive}
          elapsedSeconds={elapsedSeconds}
          onToggle={handleToggle}
          tasks={tasks}
          selectedTaskId={selectedTaskId}
          showTaskPicker={showTaskPicker}
          onTaskClick={() => setShowTaskPicker(true)}
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

      {showTaskPicker && (
        <>
          <div
            onClick={() => setShowTaskPicker(false)}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }}
          />
          <TaskPicker
            tasks={tasks}
            selectedTaskId={selectedTaskId}
            onSelect={(id) => { setSelectedTaskId(id); setShowTaskPicker(false); }}
          />
        </>
      )}
    </div>
  );
}
