import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import Timer from "./components/Timer";
import Today from "./components/Today";
import Summary from "./components/Summary";
import SettingsScreen from "./components/SettingsScreen";
import HistoryScreen from "./components/HistoryScreen";
import EditTimeEntryScreen from "./components/EditTimeEntryScreen";
import EditActiveEntryScreen from "./components/EditActiveEntryScreen";
import {
  Settings, Task, TimeEntry,
  initDB, getSettings, getTasks,
  getTodayEntries, getWeekEntries, getMonthEntries,
  startEntry, stopEntry, getActiveEntry,
} from "./db";

type Screen = "timer" | "settings" | "editTimeEntry" | "editActiveEntry" | "history";

const DEFAULT_SETTINGS: Settings = { hourlyRate: 30, currency: "USD", dailyGoalSeconds: 21600 };

export default function App() {
  const [screen, setScreen] = useState<Screen>("timer");
  const [isActive, setIsActive] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const currentDateRef = useRef<string>(new Date().toISOString().slice(0, 10));
  const contentRef = useRef<HTMLDivElement>(null);

  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const [selectedEditTaskId, setSelectedEditTaskId] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [todayEntries, setTodayEntries] = useState<TimeEntry[]>([]);
  const [weekEntries, setWeekEntries] = useState<TimeEntry[]>([]);
  const [monthEntries, setMonthEntries] = useState<TimeEntry[]>([]);

  useEffect(() => {
    (async () => {
      await initDB();
      const [s, t, today, week, month, active] = await Promise.all([
        getSettings(), getTasks(), getTodayEntries(), getWeekEntries(), getMonthEntries(),
        getActiveEntry(),
      ]);
      setSettings(s);
      setTasks(t);
      setTodayEntries(today);
      setWeekEntries(week);
      setMonthEntries(month);

      if (active) {
        const elapsed = Math.floor((Date.now() - new Date(active.startTime).getTime()) / 1000);
        startTimeRef.current = Date.now() - elapsed * 1000;
        setActiveEntryId(active.id);
        setIsActive(true);
        setElapsedSeconds(elapsed);
        const task = t.find((task) => task.id === active.taskId);
        if (task) setSelectedTaskId(task.id);
      } else {
        if (t.length) setSelectedTaskId(t[0].id);
      }
    })();
  }, []);

  useEffect(() => {
    if (!isActive) return;
    if (startTimeRef.current === null) startTimeRef.current = Date.now();
    const interval = setInterval(() => {
      if (startTimeRef.current !== null) {
        setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }
    }, 500);
    return () => clearInterval(interval);
  }, [isActive]);

  useEffect(() => {
    const resize = (h: number) => {
      const capped = Math.min(h, 640);
      invoke("resize_window", { width: 440, height: capped });
    };
    if (screen === "settings") {
      resize(520);
    } else if (screen === "history") {
      resize(600);
    } else if (screen === "editActiveEntry") {
      resize(280);
    } else if (screen === "editTimeEntry") {
      const n = todayEntries.filter((e) => e.taskId === selectedEditTaskId && e.endTime !== null).sort((a, b) => a.startTime.localeCompare(b.startTime)).length;
      const h = n <= 1 ? 380 : Math.min(640, 196 + n * 168);
      resize(h);
    } else if (!isExpanded) {
      resize(144);
    }
    // expanded case: measured after render via ReszeObserver
  }, [screen, isExpanded, selectedEditTaskId, todayEntries]);

  useEffect(() => {
    if (screen !== "timer" || !isExpanded || !contentRef.current) return;
    const el = contentRef.current;
    const measure = () => {
      const h = Math.min(el.scrollHeight + 36, 640);
      invoke("resize_window", { width: 440, height: h });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [screen, isExpanded, todayEntries]);

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

  useEffect(() => {
    const interval = setInterval(() => {
      const today = new Date().toISOString().slice(0, 10);
      if (today !== currentDateRef.current) {
        currentDateRef.current = today;
        loadData();
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [loadData]);

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

  const handleTaskStart = async (taskId: string) => {
    if (isActive) {
      const elapsed = startTimeRef.current !== null ? Math.floor((Date.now() - startTimeRef.current) / 1000) : elapsedSeconds;
      if (activeEntryId) await stopEntry(activeEntryId, new Date().toISOString(), elapsed);
    }
    const task = tasks.find((t) => t.id === taskId);
    const id = await startEntry(taskId, task?.name ?? "", settings.hourlyRate, settings.currency);
    setActiveEntryId(id);
    setSelectedTaskId(taskId);
    startTimeRef.current = Date.now();
    setElapsedSeconds(0);
    setIsActive(true);
    await refresh();
  };

  const handleCopyReport = async () => {
    const taskMap: Record<string, { name: string; seconds: number }> = {};
    monthEntries.forEach((e) => {
      if (!taskMap[e.taskId]) taskMap[e.taskId] = { name: e.taskNameSnapshot, seconds: 0 };
      taskMap[e.taskId].seconds += e.durationSeconds ?? 0;
    });

    const now = new Date();
    const monthName = now.toLocaleString("en-US", { month: "short" });
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dateRange = `1\u2013${lastDay} ${monthName}`;
    const rate = settings.hourlyRate;
    const currency = settings.currency;

    const fmtHM = (secs: number) => {
      const totalMin = Math.ceil(secs / 60);
      const h = Math.floor(totalMin / 60);
      const m = totalMin % 60;
      return m === 0 ? `${h}h` : `${h}h ${String(m).padStart(2, "0")}m`;
    };

    const fmtAmount = (secs: number) => {
      const totalMin = Math.ceil(secs / 60);
      const amount = (totalMin / 60) * rate;
      const symbol = currency === "USD" ? "$" : currency === "EUR" ? "\u20ac" : currency === "GBP" ? "\u00a3" : currency + " ";
      return `${amount.toFixed(0)}${symbol}`;
    };

    let totalSeconds = 0;
    const taskLines: string[] = [];
    Object.values(taskMap).forEach(({ name, seconds }) => {
      taskLines.push(`${name} \u2013 ${fmtHM(seconds)}`);
      totalSeconds += seconds;
    });

    const text = [
      dateRange,
      fmtHM(totalSeconds),
      taskLines.join(", "),
      fmtAmount(totalSeconds),
    ].join("\n");

    await navigator.clipboard.writeText(text);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastVisible(true);
    toastTimerRef.current = setTimeout(() => setToastVisible(false), 2000);
  };

  if (screen === "history") {
    return (
      <HistoryScreen
        activeEntryId={activeEntryId}
        onClose={() => setScreen("timer")}
      />
    );
  }

  if (screen === "settings") {
    return (
      <SettingsScreen
        onClose={() => { setScreen("timer"); loadData(); }}
        onSave={() => { setScreen("timer"); loadData(); }}
      />
    );
  }

  if (screen === "editActiveEntry" && activeEntryId) {
    const activeEntry = todayEntries.find((e) => e.id === activeEntryId) ?? null;
    return (
      <EditActiveEntryScreen
        entryId={activeEntryId}
        taskId={selectedTaskId}
        startTime={activeEntry?.startTime ?? new Date().toISOString()}
        tasks={tasks}
        onClose={() => setScreen("timer")}
        onSave={(newTaskId: string, newStartISO: string) => {
          setSelectedTaskId(newTaskId);
          startTimeRef.current = Date.now() - (Date.now() - new Date(newStartISO).getTime());
          setScreen("timer");
          refresh();
        }}
      />
    );
  }

  if (screen === "editTimeEntry") {
    return (
      <EditTimeEntryScreen
        entries={todayEntries.filter((e) => e.taskId === selectedEditTaskId && e.endTime !== null).sort((a, b) => a.startTime.localeCompare(b.startTime))}
        tasks={tasks}
        onClose={() => { setScreen("timer"); loadData(); }}
      />
    );
  }

  return (
    <div ref={contentRef} style={{
      width: 440,
      background: "#FFFFFF",
      fontFamily: "'Inter', sans-serif",
      position: "relative",
    }}>
      <div style={{
        position: "fixed",
        top: 16,
        left: "50%",
        transform: "translateX(-50%)",
        background: "#181A2C",
        color: "white",
        borderRadius: 8,
        padding: "8px 16px",
        fontSize: 14,
        fontFamily: "'Inter', sans-serif",
        whiteSpace: "nowrap",
        zIndex: 999,
        pointerEvents: "none",
        opacity: toastVisible ? 1 : 0,
        transition: "opacity 0.25s ease",
      }}>
        Report copied
      </div>
      <div style={{ position: "absolute", top: 0, left: 0, width: 440, height: 80 }}>
        <Timer
          isActive={isActive}
          elapsedSeconds={elapsedSeconds}
          onToggle={handleToggle}
          onTimeClick={() => setScreen("editActiveEntry")}
          tasks={tasks}
          selectedTaskId={selectedTaskId}
          onTaskSelect={(id) => setSelectedTaskId(id)}
          onCopyReport={handleCopyReport}
          onHistory={() => setScreen("history")}
          onSettings={() => setScreen("settings")}
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
              activeTaskId={isActive ? selectedTaskId : undefined}
              onTaskStart={handleTaskStart}
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

    </div>
  );
}
