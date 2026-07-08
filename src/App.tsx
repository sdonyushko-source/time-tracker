import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import Timer from "./components/Timer";
import MainContent from "./components/MainContent";
import SettingsScreen from "./components/SettingsScreen";
import HistoryScreen from "./components/HistoryScreen";
import EditTimeEntryScreen from "./components/EditTimeEntryScreen";
import EditActiveEntryScreen from "./components/EditActiveEntryScreen";
import {
  Settings, Task, TimeEntry,
  initDB, getSettings, getTasks,
  getLast7DaysEntries, getWeekEntries, getMonthEntries,
  startEntry, stopEntry, getActiveEntry,
} from "./db";
import { formatAmount } from "./utils";

type Screen = "timer" | "settings" | "editTimeEntry" | "editActiveEntry" | "history";

const DEFAULT_SETTINGS: Settings = { hourlyRate: 30, currency: "USD", dailyGoalSeconds: 21600 };

function getLocalDate(): string {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("timer");
  const [isActive, setIsActive] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const currentDateRef = useRef<string>(getLocalDate());

  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const [selectedEditTaskId, setSelectedEditTaskId] = useState("");
  const [selectedEditDate, setSelectedEditDate] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [last7Entries, setLast7Entries] = useState<TimeEntry[]>([]);
  const [weekEntries, setWeekEntries] = useState<TimeEntry[]>([]);
  const [monthEntries, setMonthEntries] = useState<TimeEntry[]>([]);

  useEffect(() => {
    (async () => {
      await initDB();
      const [s, t, last7, week, month, active] = await Promise.all([
        getSettings(), getTasks(), getLast7DaysEntries(), getWeekEntries(), getMonthEntries(),
        getActiveEntry(),
      ]);
      setSettings(s);
      setTasks(t);
      setLast7Entries(last7);
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
      invoke("resize_window", { width: 440, height: Math.min(h, 640) });
    };
    if (screen === "settings") {
      resize(520);
    } else if (screen === "history") {
      resize(600);
    } else if (screen === "editActiveEntry") {
      resize(280);
    } else if (screen === "editTimeEntry") {
      const n = last7Entries.filter((e) => e.taskId === selectedEditTaskId && e.date === selectedEditDate && e.endTime !== null).length;
      const h = n <= 1 ? 380 : Math.min(640, 196 + n * 168);
      resize(h);
    } else {
      resize(500);
    }
  }, [screen, selectedEditTaskId, selectedEditDate, last7Entries]);

  const refresh = useCallback(async () => {
    const [last7, week, month] = await Promise.all([
      getLast7DaysEntries(), getWeekEntries(), getMonthEntries(),
    ]);
    setLast7Entries(last7);
    setWeekEntries(week);
    setMonthEntries(month);
  }, []);

  const loadData = useCallback(async () => {
    const [s, t, last7, week, month] = await Promise.all([
      getSettings(), getTasks(), getLast7DaysEntries(), getWeekEntries(), getMonthEntries(),
    ]);
    setSettings(s);
    setTasks(t);
    setSelectedTaskId((prev) => (t.find((task) => task.id === prev) ? prev : t.length ? t[0].id : ""));
    setLast7Entries(last7);
    setWeekEntries(week);
    setMonthEntries(month);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const today = getLocalDate();
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
    const dateRange = `1–${lastDay} ${monthName}`;
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
      const symbol = currency === "USD" ? "$" : currency === "EUR" ? "€" : currency === "GBP" ? "£" : currency + " ";
      return `${amount.toFixed(0)}${symbol}`;
    };

    let totalSeconds = 0;
    const taskLines: string[] = [];
    Object.values(taskMap).forEach(({ name, seconds }) => {
      taskLines.push(`${name} – ${fmtHM(seconds)}`);
      totalSeconds += seconds;
    });

    const text = [dateRange, fmtHM(totalSeconds), taskLines.join(", "), fmtAmount(totalSeconds)].join("\n");

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const el = document.createElement("textarea");
      el.value = text;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastVisible(true);
    toastTimerRef.current = setTimeout(() => setToastVisible(false), 2000);
  };

  if (screen === "history") {
    return <HistoryScreen activeEntryId={activeEntryId} onClose={() => setScreen("timer")} />;
  }

  if (screen === "settings") {
    return <SettingsScreen onClose={() => { setScreen("timer"); loadData(); }} onSave={() => { setScreen("timer"); loadData(); }} />;
  }

  if (screen === "editActiveEntry" && activeEntryId) {
    const activeEntry = last7Entries.find((e) => e.id === activeEntryId) ?? null;
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
    const editEntries = last7Entries
      .filter((e) => e.taskId === selectedEditTaskId && e.date === selectedEditDate && e.endTime !== null)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    return (
      <EditTimeEntryScreen
        entries={editEntries}
        tasks={tasks}
        onClose={() => { setScreen("timer"); loadData(); }}
      />
    );
  }

  const today = getLocalDate();
  const todaySeconds = last7Entries
    .filter((e) => e.date === today && e.endTime !== null)
    .reduce((s, e) => s + (e.durationSeconds ?? 0), 0);
  const weekSeconds = weekEntries.reduce((s, e) => s + (e.durationSeconds ?? 0), 0);
  const monthSeconds = monthEntries.reduce((s, e) => s + (e.durationSeconds ?? 0), 0);
  const rate = settings.hourlyRate;
  const currency = settings.currency;

  return (
    <div style={{ width: 440, height: "100vh", background: "#FFFFFF", fontFamily: "'Inter', sans-serif", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", background: "#181A2C", color: "white", borderRadius: 8, padding: "8px 16px", fontSize: 14, fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap", zIndex: 999, pointerEvents: "none", opacity: toastVisible ? 1 : 0, transition: "opacity 0.25s ease" }}>
        Report copied
      </div>
      <div style={{ flexShrink: 0, height: 64 }}>
        <Timer isActive={isActive} elapsedSeconds={elapsedSeconds} onToggle={handleToggle} onTimeClick={() => setScreen("editActiveEntry")} tasks={tasks} selectedTaskId={selectedTaskId} onTaskSelect={(id) => setSelectedTaskId(id)} onCopyReport={handleCopyReport} onHistory={() => setScreen("history")} onSettings={() => setScreen("settings")} />
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "0 24px", scrollbarWidth: "none" }}>
        <MainContent last7Entries={last7Entries} settings={settings} activeTaskId={selectedTaskId} activeEntryId={activeEntryId} elapsedSeconds={elapsedSeconds} isActive={isActive} onTaskClick={(taskId, date) => { setSelectedEditTaskId(taskId); setSelectedEditDate(date); setScreen("editTimeEntry"); }} onTaskStart={handleTaskStart} />
      </div>
      <div style={{ flexShrink: 0, borderTop: "1px solid #E3E5EA", padding: "10px 24px", display: "flex", alignItems: "center", background: "#F6F6F6" }}>
        <span style={{ flex: 1, fontSize: 15, color: "#181A2C", lineHeight: "24px" }}>Earned</span>
        <span style={{ width: 96, textAlign: "right", fontSize: 15, color: "#181A2C", lineHeight: "24px", fontFamily: "'Inter', sans-serif", fontVariantNumeric: "tabular-nums" }}>{formatAmount((todaySeconds / 3600) * rate, currency)}</span>
        <span style={{ width: 96, textAlign: "right", fontSize: 15, color: "#181A2C", lineHeight: "24px", fontFamily: "'Inter', sans-serif", fontVariantNumeric: "tabular-nums" }}>{formatAmount((weekSeconds / 3600) * rate, currency)}</span>
        <span style={{ width: 96, textAlign: "right", fontSize: 15, fontWeight: 500, color: "#181A2C", lineHeight: "24px", fontFamily: "'Inter', sans-serif", fontVariantNumeric: "tabular-nums" }}>{formatAmount((monthSeconds / 3600) * rate, currency)}</span>
      </div>
    </div>
  );
}
