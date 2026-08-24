import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ThemeProvider, useTheme } from "./ThemeContext";
import Timer from "./components/Timer";
import TitleBarButtons from "./components/TitleBarButtons";
import TodaySection from "./components/TodaySection";
import CompactProgress from "./components/CompactProgress";
import MainContent from "./components/MainContent";
import SettingsScreen from "./components/SettingsScreen";
import TaskManagerScreen from "./components/TaskManagerScreen";
import HistoryScreen from "./components/HistoryScreen";
import StatisticsScreen from "./components/StatisticsScreen";
import EditTimeEntryScreen from "./components/EditTimeEntryScreen";
import EditActiveEntryScreen from "./components/EditActiveEntryScreen";
import Tooltip from "./components/Tooltip";
import {
  Settings, Task, TimeEntry,
  initDB, getSettings, getTasks,
  getLast7DaysEntries, getWeekEntries, getMonthEntries, getAllEntries, getRecentDaysEntries,
  startEntry, stopEntry, getActiveEntry,
} from "./db";
import { formatAmount, formatTimeRU, buildMonthlyReportText, copyTextToClipboard, formatMonthDateRange } from "./utils";

type Screen = "timer" | "settings" | "taskManager" | "editTimeEntry" | "editActiveEntry" | "history" | "statistics";

const DEFAULT_SETTINGS: Settings = {
  hourlyRate: 30,
  currency: "USD",
  dailyGoalSeconds: 21600,
  dailyGoalEnabled: true,
  dailyGoalType: "hours",
  dailyGoalMoney: 0,
  roundReportMinutes: 10,
  theme: "system",
  commission: 0,
};

function getLocalDate(): string {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

export default function App() {
  return (
    <ThemeProvider initialSetting="system">
      <AppContent />
    </ThemeProvider>
  );
}

function AppContent() {
  const { colors, setThemeSetting } = useTheme();
  const [screen, setScreen] = useState<Screen>("timer");
  // Compact main screen (126px, just Timer + progress bar). Always starts
  // "full" on launch — not persisted across restarts, per spec. Every other
  // screen (Settings, History, ...) always opens at the standard size
  // regardless of this, and the main screen returns to whatever this was
  // set to when navigating back.
  const [mainViewMode, setMainViewMode] = useState<"compact" | "full">("full");
  const [isActive, setIsActive] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  // Mirrors startTimeRef.current as state so the tray-timer effect below can
  // react to it changing — a ref alone can't be an effect dependency, and
  // the start time can change (task switch, manual edit) without isActive
  // itself flipping, which used to leave the native tray thread ticking
  // from a stale start time.
  const [activeStartMs, setActiveStartMs] = useState<number | null>(null);
  const currentDateRef = useRef<string>(getLocalDate());

  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const [selectedEditTaskId, setSelectedEditTaskId] = useState("");
  const [selectedEditDate, setSelectedEditDate] = useState("");
  // History can link to entries older than the last7Entries window, so its
  // edit clicks fetch and pass the exact entries directly instead of relying
  // on the taskId/date filter below (which only sees the last 7 days).
  const [editEntriesOverride, setEditEntriesOverride] = useState<TimeEntry[] | null>(null);
  const [editReturnScreen, setEditReturnScreen] = useState<Screen>("timer");
  const [historyFocusDate, setHistoryFocusDate] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [last7Entries, setLast7Entries] = useState<TimeEntry[]>([]);
  const [weekEntries, setWeekEntries] = useState<TimeEntry[]>([]);
  const [monthEntries, setMonthEntries] = useState<TimeEntry[]>([]);
  const [recentEntries, setRecentEntries] = useState<TimeEntry[]>([]);
  // Lets the menu-action listener below (registered once, empty deps) always
  // call the current handleCopyReport — which itself closes over changing
  // state (monthEntries/settings) and is redefined every render — without
  // re-subscribing the native-event listener on every render to do it.
  const handleCopyReportRef = useRef<() => void>(() => {});

  // Runs on every screen/mode change — covers initial mount, navigating to
  // any sub-screen (always standard size), and returning to the main screen
  // (back to whatever mainViewMode was left at).
  useEffect(() => {
    const height = screen === "timer" && mainViewMode === "compact" ? 126 : 500;
    invoke("resize_window", { width: 440, height });
  }, [screen, mainViewMode]);

  // The "..." menu is a native macOS context menu (built in Rust — see
  // show_more_menu) rather than HTML, so it's never clipped by the compact
  // 126px window. Clicks come back here as a "menu-action" event instead of
  // direct callback props, since Timer no longer owns any menu state.
  useEffect(() => {
    const unlisten = listen<string>("menu-action", (event) => {
      switch (event.payload) {
        case "copy_report": handleCopyReportRef.current(); break;
        case "statistics": setScreen("statistics"); break;
        case "history": setScreen("history"); break;
        case "task_manager": setScreen("taskManager"); break;
        case "settings": setScreen("settings"); break;
      }
    });
    return () => { unlisten.then((f) => f()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await initDB();
        const [s, t, last7, week, month, recent, active] = await Promise.all([
          getSettings(), getTasks(), getLast7DaysEntries(), getWeekEntries(), getMonthEntries(),
          getRecentDaysEntries(5), getActiveEntry(),
        ]);
        setSettings(s);
        setThemeSetting(s.theme);
        setTasks(t);
        setLast7Entries(last7);
        setWeekEntries(week);
        setMonthEntries(month);
        setRecentEntries(recent);

        if (active) {
          const elapsed = Math.floor((Date.now() - new Date(active.startTime).getTime()) / 1000);
          startTimeRef.current = Date.now() - elapsed * 1000;
          setActiveStartMs(startTimeRef.current);
          setActiveEntryId(active.id);
          setIsActive(true);
          setElapsedSeconds(elapsed);
          const task = t.find((task) => task.id === active.taskId);
          if (task) setSelectedTaskId(task.id);
        } else {
          if (t.length) setSelectedTaskId(t[0].id);
        }
      } catch (err) {
        console.error("startup data load failed", err);
      }
    })();
  }, []);

  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      if (startTimeRef.current !== null) {
        setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }
    }, 500);
    return () => clearInterval(interval);
  }, [isActive]);

  // Ticking is done natively in Rust (a plain OS thread), not here — a
  // renderer-side setInterval gets throttled/suspended by WKWebView once
  // the window loses visibility, which used to freeze the tray title.
  // Depending on activeStartMs (not just isActive) is what makes this
  // restart correctly on a task switch or a manual start-time edit.
  useEffect(() => {
    if (!isActive || activeStartMs === null) {
      invoke("stop_tray_timer").catch(() => {});
      return;
    }
    invoke("start_tray_timer", { startTimeMs: activeStartMs }).catch(() => {});
  }, [isActive, activeStartMs]);

  const refresh = useCallback(async () => {
    const [last7, week, month, recent] = await Promise.all([
      getLast7DaysEntries(), getWeekEntries(), getMonthEntries(), getRecentDaysEntries(5),
    ]);
    setLast7Entries(last7);
    setWeekEntries(week);
    setMonthEntries(month);
    setRecentEntries(recent);
  }, []);

  const loadData = useCallback(async () => {
    const [s, t, last7, week, month, recent] = await Promise.all([
      getSettings(), getTasks(), getLast7DaysEntries(), getWeekEntries(), getMonthEntries(), getRecentDaysEntries(5),
    ]);
    setSettings(s);
    setThemeSetting(s.theme);
    setTasks(t);
    setSelectedTaskId((prev) => (t.find((task) => task.id === prev) ? prev : t.length ? t[0].id : ""));
    setLast7Entries(last7);
    setWeekEntries(week);
    setMonthEntries(month);
    setRecentEntries(recent);
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
      setActiveStartMs(null);
      setIsActive(false);
      setElapsedSeconds(0);
      await refresh();
    } else {
      if (!selectedTaskId) return;
      const task = tasks.find((t) => t.id === selectedTaskId);
      const id = await startEntry(selectedTaskId, task?.name ?? "", settings.hourlyRate, settings.currency);
      setActiveEntryId(id);
      startTimeRef.current = Date.now();
      setActiveStartMs(startTimeRef.current);
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
    setActiveStartMs(startTimeRef.current);
    setElapsedSeconds(0);
    setIsActive(true);
    await refresh();
  };

  const handleHistoryEntryClick = async (taskId: string, date: string) => {
    const all = await getAllEntries();
    const entries = all
      .filter((e) => e.taskId === taskId && e.date === date && e.endTime !== null)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    setEditEntriesOverride(entries);
    setEditReturnScreen("history");
    setScreen("editTimeEntry");
  };

  const handleCopyReport = async () => {
    const now = new Date();
    const ym = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
    const text = buildMonthlyReportText(monthEntries, formatMonthDateRange(ym), {
      rate: settings.hourlyRate,
      currency: settings.currency,
      roundReportMinutes: settings.roundReportMinutes,
    });
    await copyTextToClipboard(text);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastVisible(true);
    toastTimerRef.current = setTimeout(() => setToastVisible(false), 2000);
  };
  handleCopyReportRef.current = handleCopyReport;

  if (screen === "history") {
    return (
      <HistoryScreen
        activeEntryId={activeEntryId}
        focusDate={historyFocusDate}
        settings={settings}
        onClose={() => { setScreen("timer"); setHistoryFocusDate(null); }}
        onEntryClick={handleHistoryEntryClick}
      />
    );
  }

  if (screen === "statistics") {
    return <StatisticsScreen settings={settings} onClose={() => setScreen("timer")} />;
  }

  if (screen === "settings") {
    return <SettingsScreen onClose={() => { setScreen("timer"); loadData(); }} />;
  }

  if (screen === "taskManager") {
    return <TaskManagerScreen onClose={() => { setScreen("timer"); loadData(); }} />;
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
          setActiveStartMs(startTimeRef.current);
          setScreen("timer");
          refresh();
        }}
      />
    );
  }

  if (screen === "editTimeEntry") {
    const editEntries = editEntriesOverride ?? last7Entries
      .filter((e) => e.taskId === selectedEditTaskId && e.date === selectedEditDate && e.endTime !== null)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    return (
      <EditTimeEntryScreen
        entries={editEntries}
        tasks={tasks}
        onClose={() => { setEditEntriesOverride(null); setScreen(editReturnScreen); setEditReturnScreen("timer"); loadData(); }}
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
    <div style={{ width: 440, height: "100vh", background: colors.pageBg, fontFamily: "'Inter', sans-serif", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", background: "#181A2C", color: "white", borderRadius: 8, padding: "8px 16px", fontSize: 14, fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap", zIndex: 999, pointerEvents: "none", opacity: toastVisible ? 1 : 0, transition: "opacity 0.25s ease" }}>
        Report copied
      </div>
      {mainViewMode === "compact" ? (
        <div>
          <TitleBarButtons isCompact onToggleView={() => setMainViewMode((m) => (m === "compact" ? "full" : "compact"))} />
          <Timer isActive={isActive} elapsedSeconds={elapsedSeconds} onToggle={handleToggle} onTimeClick={() => setScreen("editActiveEntry")} tasks={tasks} selectedTaskId={selectedTaskId} onTaskSelect={(id) => setSelectedTaskId(id)} />
          <CompactProgress last7Entries={last7Entries} settings={settings} />
        </div>
      ) : (
        <>
          <TitleBarButtons isCompact={false} onToggleView={() => setMainViewMode((m) => (m === "compact" ? "full" : "compact"))} />
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", scrollbarWidth: "none" }}>
            <Timer isActive={isActive} elapsedSeconds={elapsedSeconds} onToggle={handleToggle} onTimeClick={() => setScreen("editActiveEntry")} tasks={tasks} selectedTaskId={selectedTaskId} onTaskSelect={(id) => setSelectedTaskId(id)} />
            <div style={{
              margin: "8px 8px 12px",
              background: colors.cardBg,
              borderRadius: 12,
              padding: 8,
              boxSizing: "border-box",
            }}>
              <TodaySection last7Entries={last7Entries} settings={settings} activeTaskId={selectedTaskId} isActive={isActive} onTaskClick={(taskId, date) => { setEditEntriesOverride(null); setSelectedEditTaskId(taskId); setSelectedEditDate(date); setScreen("editTimeEntry"); }} onTaskStart={handleTaskStart} />
            </div>
            <div style={{ padding: "0 8px" }}>
              <MainContent
                recentEntries={recentEntries}
                onDateClick={(date) => { setHistoryFocusDate(date); setScreen("history"); }}
                onTaskClick={(taskId, date) => {
                  const entries = recentEntries
                    .filter((e) => e.taskId === taskId && e.date === date && e.endTime !== null)
                    .sort((a, b) => a.startTime.localeCompare(b.startTime));
                  setEditEntriesOverride(entries);
                  setSelectedEditTaskId(taskId);
                  setSelectedEditDate(date);
                  setScreen("editTimeEntry");
                }}
                onTaskStart={handleTaskStart}
              />
            </div>
          </div>
          <div style={{ flexShrink: 0, borderTop: colors.footerBorder, padding: "10px 24px", display: "flex", alignItems: "center", background: colors.cardBg }}>
            <div style={{ flex: 1, display: "flex" }}>
              <Tooltip content="Hours worked this month">
                <span style={{ fontSize: 15, color: colors.textPrimary, lineHeight: "24px", fontVariantNumeric: "tabular-nums" }}>{formatTimeRU(monthSeconds)}</span>
              </Tooltip>
            </div>
            <div style={{ width: 96, display: "flex", justifyContent: "flex-end" }}>
              <Tooltip content="Earned today">
                <span style={{ fontSize: 15, color: colors.textPrimary, lineHeight: "24px", fontFamily: "'Inter', sans-serif", fontVariantNumeric: "tabular-nums" }}>{formatAmount((todaySeconds / 3600) * rate, currency)}</span>
              </Tooltip>
            </div>
            <div style={{ width: 96, display: "flex", justifyContent: "flex-end" }}>
              <Tooltip content="Earned this week">
                <span style={{ fontSize: 15, color: colors.textPrimary, lineHeight: "24px", fontFamily: "'Inter', sans-serif", fontVariantNumeric: "tabular-nums" }}>{formatAmount((weekSeconds / 3600) * rate, currency)}</span>
              </Tooltip>
            </div>
            <div style={{ width: 96, display: "flex", justifyContent: "flex-end" }}>
              <Tooltip
                content={
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span>Earned this month</span>
                    <span>Net of commission: {formatAmount((monthSeconds / 3600) * rate * (1 - settings.commission / 100), currency)}</span>
                  </div>
                }
              >
                <span style={{ fontSize: 15, fontWeight: 500, color: colors.textPrimary, lineHeight: "24px", fontFamily: "'Inter', sans-serif", fontVariantNumeric: "tabular-nums" }}>{formatAmount((monthSeconds / 3600) * rate, currency)}</span>
              </Tooltip>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
