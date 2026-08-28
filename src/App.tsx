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
import ScheduleScreen from "./components/ScheduleScreen";
import EditTimeEntryScreen from "./components/EditTimeEntryScreen";
import EditActiveEntryScreen from "./components/EditActiveEntryScreen";
import Tooltip from "./components/Tooltip";
import { AVATAR_COLORS } from "./components/ClientAvatar";
import {
  Settings, Task, TimeEntry, Client,
  initDB, getSettings, getTasks, getAllTasks, getClients,
  getLast7DaysEntries, getWeekEntries, getMonthEntries, getAllEntries, getRecentDaysEntries,
  startEntry, stopEntry, getActiveEntry, getSchedules,
} from "./db";
import { formatAmount, formatTimeRU, formatDurationEN, formatHM, computeAutoStopDeadline, buildMonthlyReportText, copyTextToClipboard, formatMonthDateRange, computeVisibleClients, clientDisplayName, resolveClientId } from "./utils";
import type { AutoStopDeadline } from "./utils";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";

type Screen = "timer" | "settings" | "taskManager" | "editTimeEntry" | "editActiveEntry" | "history" | "statistics" | "schedule";

const DEFAULT_SETTINGS: Settings = {
  currency: "USD",
  dailyGoalSeconds: 21600,
  dailyGoalEnabled: true,
  dailyGoalType: "hours",
  dailyGoalMoney: 0,
  roundReportMinutes: 10,
  theme: "system",
  focusMinutes: 0,
  maxSessionHours: 10,
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
  // Focus (Pomodoro) cycle. The actual countdown lives in Rust (see
  // start_focus in lib.rs) for the same reason the tray timer does — a
  // renderer-side setInterval gets throttled once the window loses
  // visibility. focusStartedAtMs/focusDurationMs are only used to *derive*
  // the ring's progress and the remaining-time tooltip fresh from wall-clock
  // time on each render; focusTick below just forces those re-renders once a
  // second while a cycle is running.
  const [focusActive, setFocusActive] = useState(false);
  const [focusStartedAtMs, setFocusStartedAtMs] = useState<number | null>(null);
  const [focusDurationMs, setFocusDurationMs] = useState(0);
  const [, setFocusTick] = useState(0);
  // The task name a running cycle's notification should mention — captured
  // at start and re-sent as-is if the cycle gets rescheduled mid-flight (see
  // the settings.focusMinutes effect below), since the task itself can't
  // change without cancelling the cycle first (see cancelFocus's callers).
  const focusTaskNameRef = useRef<string | null>(null);

  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  // Includes archived tasks — only used to resolve a past entry's client for
  // money math (footer, commission), where a since-deleted task must still
  // attribute correctly. Interactive stuff (picker, labels, new-entry rate)
  // uses `tasks` (active only) instead.
  const [allTasks, setAllTasks] = useState<Task[]>([]);
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
  // Same stale-closure problem as handleCopyReportRef, for the schedule
  // checker below (registered once, empty deps) calling handleTaskStart /
  // stopActive (which close over changing state and are redefined every
  // render).
  const handleTaskStartRef = useRef<(taskId: string) => Promise<string | undefined>>(async () => undefined);
  const stopActiveRef = useRef<() => void>(() => {});
  // Mirrors activeEntryId as a ref so the schedule checker (registered once,
  // empty deps) can read the *current* value without re-subscribing.
  const activeEntryIdRef = useRef<string | null>(null);
  // Tracks which schedules already fired their 5-minutes-before notification
  // / autostart today, keyed "${scheduleId}:${date}" — naturally resets
  // itself once the date rolls over since the key changes.
  const notifiedScheduleRef = useRef<Set<string>>(new Set());
  const autoStartedScheduleRef = useRef<Set<string>>(new Set());
  // Set when a schedule auto-starts a task, cleared once that entry is
  // stopped (by the schedule itself or manually). Holding the entryId means
  // the scheduled stop only ever affects the exact entry it started — if the
  // user switches tasks or stops manually in the meantime, this becomes
  // stale and the duration check below just no-ops instead of stopping
  // whatever happens to be running later.
  const scheduledStopRef = useRef<{ entryId: string; stopAtMs: number } | null>(null);
  // The active entry's own planned end time (EditActiveEntryScreen), kept in
  // sync alongside activeEntryId/activeStartMs — null when unset (runs until
  // manual Stop, modulo the maxSessionHours safety net).
  const [activePlannedEndTime, setActivePlannedEndTime] = useState<string | null>(null);
  // Whichever deadline is currently armed in Rust (see start_auto_stop in
  // lib.rs) — the nearer of plannedEndTime and the maxSessionHours cap, or
  // null if neither applies. Read by the auto-stop-deadline listener below
  // (registered once, empty deps) to know what to write as endTime and which
  // notification wording to use — not React state since nothing renders it.
  const autoStopArmedRef = useRef<(AutoStopDeadline & { maxSessionHours: number }) | null>(null);
  // Same stale-closure fix as stopActiveRef/handleTaskStartRef — called from
  // the stably-registered auto-stop-deadline listener and the periodic
  // schedule-checker's own safety-net check below, neither of which
  // re-subscribes on every render.
  const finalizeAutoStopRef = useRef<() => void>(() => {});
  // Mirrors tasks/selectedTaskId for the same reason activeEntryIdRef exists
  // above — the auto-stop-deadline listener needs the task's *current* name
  // for its notification body without re-subscribing on every render.
  const tasksRef = useRef<Task[]>([]);
  const selectedTaskIdRef = useRef<string>("");

  useEffect(() => { activeEntryIdRef.current = activeEntryId; }, [activeEntryId]);
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);
  useEffect(() => { selectedTaskIdRef.current = selectedTaskId; }, [selectedTaskId]);

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
      // The native task-picker submenu (see show_task_picker_menu in
      // lib.rs) reuses this same event, with task ids prefixed "task:" so
      // they can't collide with the fixed action ids below.
      if (event.payload.startsWith("task:")) {
        setSelectedTaskId(event.payload.slice(5));
        return;
      }
      switch (event.payload) {
        case "copy_report": handleCopyReportRef.current(); break;
        case "statistics": setScreen("statistics"); break;
        case "history": setScreen("history"); break;
        case "schedule": setScreen("schedule"); break;
        case "task_manager": setScreen("taskManager"); break;
        case "settings": setScreen("settings"); break;
      }
    });
    return () => { unlisten.then((f) => f()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fired once by the Rust thread spawned in start_focus, only if the cycle
  // ran to completion uninterrupted (see FocusState's generation counter in
  // lib.rs) — a cancelled cycle never reaches this. The notification itself
  // is also sent from that same Rust thread, not here.
  useEffect(() => {
    const unlisten = listen("focus-complete", () => {
      setFocusActive(false);
      setFocusStartedAtMs(null);
    });
    return () => { unlisten.then((f) => f()); };
  }, []);

  // Fired once by the Rust thread spawned in start_auto_stop, only if it ran
  // uninterrupted (same generation-counter pattern as focus-complete above —
  // a cancelled/rescheduled deadline never reaches this). Unlike focus, the
  // notification is sent from here, not Rust: it needs the task's name and
  // formatted times, which only live on this side.
  useEffect(() => {
    const unlisten = listen("auto-stop-deadline", () => {
      finalizeAutoStopRef.current();
    });
    return () => { unlisten.then((f) => f()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Forces Timer's ring and TitleBarButtons' tooltip to recompute their
  // wall-clock-derived progress/remaining-time once a second while a cycle
  // is running — see the comment on focusStartedAtMs above.
  useEffect(() => {
    if (!focusActive) return;
    const interval = setInterval(() => setFocusTick((n) => n + 1), 1000);
    return () => clearInterval(interval);
  }, [focusActive]);

  useEffect(() => {
    (async () => {
      try {
        await initDB();
        const [s, t, cl, allT, last7, week, month, recent, active] = await Promise.all([
          getSettings(), getTasks(), getClients(), getAllTasks(), getLast7DaysEntries(), getWeekEntries(), getMonthEntries(),
          getRecentDaysEntries(5), getActiveEntry(),
        ]);
        setSettings(s);
        setThemeSetting(s.theme);
        setTasks(t);
        setClients(cl);
        setAllTasks(allT);
        setLast7Entries(last7);
        setWeekEntries(week);
        setMonthEntries(month);
        setRecentEntries(recent);

        if (active) {
          const startMs = new Date(active.startTime).getTime();
          const deadline = computeAutoStopDeadline(startMs, active.plannedEndTime, s.maxSessionHours);

          if (deadline && deadline.deadlineMs <= Date.now()) {
            // The deadline came and went while we weren't running to catch
            // it (app quit, or a system sleep the Rust thread didn't survive
            // either) — close it retroactively AT the deadline, never at
            // this "just noticed" moment (see start_auto_stop/computeAutoStopDeadline).
            // Do not resume it as active.
            const durationSeconds = Math.max(0, Math.round((deadline.deadlineMs - startMs) / 1000));
            await stopEntry(active.id, new Date(deadline.deadlineMs).toISOString(), durationSeconds);
            if (t.length) setSelectedTaskId(t[0].id);

            const taskName = t.find((task) => task.id === active.taskId)?.name ?? active.taskNameSnapshot;
            let granted = await isPermissionGranted();
            if (!granted) granted = (await requestPermission()) === "granted";
            if (granted) {
              if (deadline.reason === "planned") {
                sendNotification({
                  title: "Timer stopped",
                  body: `${taskName} · ${formatHM(startMs)}–${formatHM(deadline.deadlineMs)} · ${formatDurationEN(durationSeconds)}`,
                });
              } else {
                sendNotification({
                  title: `Stopped after ${s.maxSessionHours} hours`,
                  body: `${taskName} — check the time is right`,
                });
              }
            }
          } else {
            const elapsed = Math.floor((Date.now() - startMs) / 1000);
            startTimeRef.current = Date.now() - elapsed * 1000;
            setActiveStartMs(startTimeRef.current);
            setActiveEntryId(active.id);
            setIsActive(true);
            setElapsedSeconds(elapsed);
            setActivePlannedEndTime(active.plannedEndTime);
            if (deadline) {
              autoStopArmedRef.current = { ...deadline, maxSessionHours: s.maxSessionHours };
              invoke("start_auto_stop", { deadlineMs: deadline.deadlineMs }).catch(() => {});
            }
            const task = t.find((task) => task.id === active.taskId);
            if (task) setSelectedTaskId(task.id);
          }
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
    const [s, t, cl, allT, last7, week, month, recent] = await Promise.all([
      getSettings(), getTasks(), getClients(), getAllTasks(), getLast7DaysEntries(), getWeekEntries(), getMonthEntries(), getRecentDaysEntries(5),
    ]);
    setSettings(s);
    setThemeSetting(s.theme);
    setTasks(t);
    setClients(cl);
    setAllTasks(allT);
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

  // Cancels a running focus cycle (invoke is harmless as a no-op if none is
  // running — it just bumps a generation counter nothing is waiting on).
  // Called unconditionally from both stopActive and handleTaskStart below,
  // per spec: a cycle is tied to whichever task was running when it
  // started, so stopping that task or switching to another one ends it —
  // silently, no notification (see start_focus's generation check).
  const cancelFocus = () => {
    invoke("stop_focus").catch(() => {});
    setFocusActive(false);
    setFocusStartedAtMs(null);
    focusTaskNameRef.current = null;
  };

  // Shared by the automatic start (task Play — see handleToggle/
  // handleTaskStart) and the manual titlebar icon (still available as an
  // override — e.g. to start a session against an already-running task, or
  // to cancel just the break reminder without stopping the task itself).
  const startFocus = async (taskName: string | null) => {
    if (settings.focusMinutes <= 0) return;
    let granted = await isPermissionGranted();
    if (!granted) granted = (await requestPermission()) === "granted";
    // Permission denied still starts the cycle — spec: no banner, but the
    // ring/icon work exactly the same.
    const durationMs = settings.focusMinutes * 60000;
    focusTaskNameRef.current = taskName;
    await invoke("start_focus", { durationSecs: settings.focusMinutes * 60, taskName }).catch(() => {});
    setFocusStartedAtMs(Date.now());
    setFocusDurationMs(durationMs);
    setFocusActive(true);
  };

  // (Re)arms the auto-stop deadline for the given start time (Rust-side —
  // see start_auto_stop in lib.rs), or cancels it if neither plannedEndTime
  // nor settings.maxSessionHours applies. Called on every task start
  // (plannedEndTime always null there — it's only ever set afterward, via
  // EditActiveEntryScreen) and whenever that screen is saved with a new one.
  const armAutoStop = (startMs: number, plannedEndTime: string | null) => {
    const deadline = computeAutoStopDeadline(startMs, plannedEndTime, settings.maxSessionHours);
    autoStopArmedRef.current = deadline ? { ...deadline, maxSessionHours: settings.maxSessionHours } : null;
    if (deadline) {
      invoke("start_auto_stop", { deadlineMs: deadline.deadlineMs }).catch(() => {});
    } else {
      invoke("stop_auto_stop").catch(() => {});
    }
  };

  const cancelAutoStop = () => {
    invoke("stop_auto_stop").catch(() => {});
    autoStopArmedRef.current = null;
  };

  // Closes the running entry AT the armed deadline (never "now" — see
  // computeAutoStopDeadline/2.6) and sends the reason-appropriate
  // notification. Called both by the auto-stop-deadline listener (the
  // common case — Rust caught it while the window was merely hidden) and by
  // the periodic schedule-checker's own safety-net check (the deadline
  // already passed by the time we got a chance to look — app was quit, or
  // survived a system sleep the Rust thread didn't).
  const finalizeAutoStop = async () => {
    const armed = autoStopArmedRef.current;
    const entryId = activeEntryIdRef.current;
    const startMs = startTimeRef.current;
    if (!armed || !entryId || startMs === null) return;

    const durationSeconds = Math.max(0, Math.round((armed.deadlineMs - startMs) / 1000));
    const endISO = new Date(armed.deadlineMs).toISOString();
    const taskName = tasksRef.current.find((t) => t.id === selectedTaskIdRef.current)?.name ?? "";

    await stopEntry(entryId, endISO, durationSeconds);
    cancelFocus();
    autoStopArmedRef.current = null;
    setActiveEntryId(null);
    startTimeRef.current = null;
    setActiveStartMs(null);
    setIsActive(false);
    setElapsedSeconds(0);
    setActivePlannedEndTime(null);
    await refresh();

    let granted = await isPermissionGranted();
    if (!granted) granted = (await requestPermission()) === "granted";
    if (!granted) return;

    if (armed.reason === "planned") {
      sendNotification({
        title: "Timer stopped",
        body: `${taskName} · ${formatHM(startMs)}–${formatHM(armed.deadlineMs)} · ${formatDurationEN(durationSeconds)}`,
      });
    } else {
      sendNotification({
        title: `Stopped after ${armed.maxSessionHours} hours`,
        body: `${taskName} — check the time is right`,
      });
    }
  };
  finalizeAutoStopRef.current = finalizeAutoStop;

  const toggleFocus = () => {
    if (focusActive) {
      cancelFocus();
    } else {
      const taskName = isActive ? tasks.find((t) => t.id === selectedTaskId)?.name ?? null : null;
      startFocus(taskName);
    }
  };

  // A cycle in progress is tied to the settings.focusMinutes value it was
  // started with, not a frozen copy of it — changing the setting in
  // Settings (which only reaches this component's `settings` state once,
  // on return to the timer screen — see SettingsScreen's onClose) reschedules
  // the still-running cycle against the new total, keeping the same
  // startedAt so the ring/tooltip immediately reflect the new percentage.
  // If the new (shorter) duration has already elapsed, the cycle just ends
  // now instead — silently, like a manual cancel, not as if it had
  // completed on its own.
  useEffect(() => {
    if (!focusActive || focusStartedAtMs === null) return;
    if (settings.focusMinutes <= 0) {
      cancelFocus();
      return;
    }
    const newDurationMs = settings.focusMinutes * 60000;
    const elapsedMs = Date.now() - focusStartedAtMs;
    if (elapsedMs >= newDurationMs) {
      cancelFocus();
      return;
    }
    setFocusDurationMs(newDurationMs);
    const remainingSecs = Math.max(1, Math.ceil((newDurationMs - elapsedMs) / 1000));
    invoke("start_focus", { durationSecs: remainingSecs, taskName: focusTaskNameRef.current }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.focusMinutes]);

  // Shared stop path — used by handleToggle (manual Stop) and by the
  // schedule checker below (auto-stop once a rule's duration elapses), so
  // both go through the exact same stopEntry call and isActive/activeStartMs
  // state updates that drive the native tray timer.
  const stopActive = async () => {
    cancelFocus();
    cancelAutoStop();
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
    setActivePlannedEndTime(null);
    await refresh();
  };
  stopActiveRef.current = stopActive;

  // Checks recurring schedules once a minute: fires a "starts in 5 minutes"
  // notification (autoStart on or off — same either way); at the exact start
  // minute, if autoStart is on, starts the task via the same stop-then-start
  // path as clicking a task row (handleTaskStart); and once the rule's
  // duration has elapsed, stops it again via the same stopActive path as a
  // manual Stop — all through the same startEntry/stopEntry snapshot logic
  // and isActive/activeStartMs state updates that drive the native tray
  // timer, instead of a separate parallel tick implementation.
  useEffect(() => {
    const checkSchedules = async () => {
      // Duration elapsed for the entry a schedule auto-started — stop it,
      // but only if it's still the same entry (guards against the user
      // having switched tasks or stopped manually in the meantime).
      if (scheduledStopRef.current && Date.now() >= scheduledStopRef.current.stopAtMs) {
        const { entryId } = scheduledStopRef.current;
        scheduledStopRef.current = null;
        if (activeEntryIdRef.current === entryId) stopActiveRef.current();
      }

      // Safety net for the auto-stop deadline (plannedEndTime / max session
      // length): this reuses the same self-realigning tick as the schedule
      // checks below rather than a dedicated OS wake listener — a JS timer
      // suspended through a system sleep just fires as soon as it's next
      // given a chance to run, checks real elapsed time, and catches up
      // immediately. The Rust thread (start_auto_stop) is what makes this
      // fire *promptly* while the window is merely hidden; this is only for
      // the cases that don't survive — app quit, or a sleep the thread
      // itself didn't (see 2.6).
      if (autoStopArmedRef.current && Date.now() >= autoStopArmedRef.current.deadlineMs) {
        finalizeAutoStopRef.current();
      }

      const schedules = await getSchedules();
      if (!schedules.length) return;
      const now = new Date();
      const today = getLocalDate();
      const weekday = now.getDay();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      for (const s of schedules) {
        if (!s.weekdays.split(",").map(Number).includes(weekday)) continue;
        const [sh, sm] = s.startTime.split(":").map(Number);
        const startMinutes = sh * 60 + sm;
        const key = `${s.id}:${today}`;

        if (nowMinutes === startMinutes - 5 && !notifiedScheduleRef.current.has(key)) {
          notifiedScheduleRef.current.add(key);
          let granted = await isPermissionGranted();
          if (!granted) granted = (await requestPermission()) === "granted";
          if (granted) sendNotification({ title: "Cuckoo", body: `${s.taskNameSnapshot} starts in 5 minutes` });
        }

        if (nowMinutes === startMinutes && s.autoStart && !autoStartedScheduleRef.current.has(key)) {
          autoStartedScheduleRef.current.add(key);
          const entryId = await handleTaskStartRef.current(s.taskId);
          // stopAtMs is derived from the rule's *nominal* start minute (today
          // at sh:sm:00), not from whenever this tick actually fired — so it
          // lands on an exact minute boundary regardless of the tick's own
          // sub-second jitter, and the aligned ticks below then catch it on
          // time instead of up to a minute late.
          if (entryId) {
            const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), sh, sm, 0, 0);
            scheduledStopRef.current = { entryId, stopAtMs: startDate.getTime() + s.durationMinutes * 60000 };
          }
        }
      }
    };

    // A plain setInterval(fn, 60000) started on mount ticks 60s apart from
    // whatever moment the app happened to launch — not from real clock
    // minute boundaries — so a schedule's start/stop could fire up to ~59s
    // late. This instead re-schedules itself via setTimeout for just past
    // (+250ms, so Date() reliably reads the new minute) each next :00.
    let timeoutId: ReturnType<typeof setTimeout>;
    let cancelled = false;
    const scheduleNextTick = () => {
      const delay = 60000 - (Date.now() % 60000) + 250;
      timeoutId = setTimeout(async () => {
        if (cancelled) return;
        await checkSchedules();
        scheduleNextTick();
      }, delay);
    };
    checkSchedules();
    scheduleNextTick();
    return () => { cancelled = true; clearTimeout(timeoutId); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rate/currency for a new entry come from whichever client the task
  // belongs to (or the default client, for clientId=NULL tasks) — Settings
  // no longer holds a global hourlyRate. An unpaid client always resolves
  // to 0 (see Client.isPaid in db.ts).
  const resolveRateForTask = (taskId: string): number => {
    const task = tasks.find((t) => t.id === taskId);
    const defaultClientId = clients.find((c) => c.isDefault)?.id ?? "";
    const clientId = task ? resolveClientId(task, defaultClientId) : defaultClientId;
    const client = clients.find((c) => c.id === clientId);
    return client && client.isPaid ? client.rate : 0;
  };

  const handleToggle = async () => {
    if (isActive) {
      await stopActive();
    } else {
      if (!selectedTaskId) return;
      const task = tasks.find((t) => t.id === selectedTaskId);
      const id = await startEntry(selectedTaskId, task?.name ?? "", resolveRateForTask(selectedTaskId), settings.currency);
      setActiveEntryId(id);
      startTimeRef.current = Date.now();
      setActiveStartMs(startTimeRef.current);
      setIsActive(true);
      setActivePlannedEndTime(null);
      armAutoStop(startTimeRef.current, null);
      await startFocus(task?.name ?? null);
      await refresh();
    }
  };

  const handleTaskStart = async (taskId: string): Promise<string> => {
    cancelFocus();
    cancelAutoStop();
    if (isActive) {
      const elapsed = startTimeRef.current !== null ? Math.floor((Date.now() - startTimeRef.current) / 1000) : elapsedSeconds;
      if (activeEntryId) await stopEntry(activeEntryId, new Date().toISOString(), elapsed);
    }
    const task = tasks.find((t) => t.id === taskId);
    const id = await startEntry(taskId, task?.name ?? "", resolveRateForTask(taskId), settings.currency);
    setActiveEntryId(id);
    setSelectedTaskId(taskId);
    startTimeRef.current = Date.now();
    setActiveStartMs(startTimeRef.current);
    setElapsedSeconds(0);
    setIsActive(true);
    setActivePlannedEndTime(null);
    armAutoStop(startTimeRef.current, null);
    await startFocus(task?.name ?? null);
    await refresh();
    return id;
  };
  handleTaskStartRef.current = handleTaskStart;

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

  if (screen === "schedule") {
    return <ScheduleScreen onClose={() => setScreen("timer")} />;
  }

  if (screen === "settings") {
    return <SettingsScreen onClose={() => { setScreen("timer"); loadData(); }} />;
  }

  if (screen === "taskManager") {
    return <TaskManagerScreen onClose={() => { setScreen("timer"); loadData(); }} />;
  }

  if (screen === "editActiveEntry" && activeEntryId) {
    return (
      <EditActiveEntryScreen
        entryId={activeEntryId}
        taskId={selectedTaskId}
        // last7Entries excludes this entry by definition (endTime IS NULL —
        // still running), so it can never be looked up there; startTimeRef
        // is the one place its real start moment actually lives.
        startTime={new Date(startTimeRef.current ?? Date.now()).toISOString()}
        plannedEndTime={activePlannedEndTime}
        tasks={tasks}
        onClose={() => setScreen("timer")}
        onSave={(newTaskId: string, newStartISO: string, newPlannedEndTime: string | null) => {
          setSelectedTaskId(newTaskId);
          startTimeRef.current = Date.now() - (Date.now() - new Date(newStartISO).getTime());
          setActiveStartMs(startTimeRef.current);
          setActivePlannedEndTime(newPlannedEndTime);
          armAutoStop(startTimeRef.current, newPlannedEndTime);
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
        clients={clients}
        onClose={() => { setEditEntriesOverride(null); setScreen(editReturnScreen); setEditReturnScreen("timer"); loadData(); }}
      />
    );
  }

  const today = getLocalDate();
  const todayEntries = last7Entries.filter((e) => e.date === today && e.endTime !== null);
  const monthSeconds = monthEntries.reduce((s, e) => s + (e.durationSeconds ?? 0), 0);
  const currency = settings.currency;

  // Amounts are summed from each entry's own hourlyRateSnapshot, not one
  // flat rate — rate lives per-client now (see Client in db.ts), so entries
  // tracked under different clients (or at a rate later changed) never
  // shared a single number to begin with.
  const sumAmount = (list: TimeEntry[]) => list.reduce((s, e) => s + ((e.durationSeconds ?? 0) / 3600) * (e.hourlyRateSnapshot ?? 0), 0);
  const todayAmount = sumAmount(todayEntries);
  const weekAmount = sumAmount(weekEntries);
  const monthAmount = sumAmount(monthEntries);

  const defaultClientId = clients.find((c) => c.isDefault)?.id ?? "";
  // allTasks (not tasks) so an entry from a since-archived task still
  // resolves to the right client for this month's commission math.
  const taskClientMap: Record<string, string> = {};
  allTasks.forEach((t) => { taskClientMap[t.id] = resolveClientId(t, defaultClientId); });
  const clientCommissionMap: Record<string, number> = {};
  clients.forEach((c) => { clientCommissionMap[c.id] = c.commission; });
  const monthNetAmount = monthEntries.reduce((s, e) => {
    const amount = ((e.durationSeconds ?? 0) / 3600) * (e.hourlyRateSnapshot ?? 0);
    const commission = clientCommissionMap[taskClientMap[e.taskId] ?? defaultClientId] ?? 0;
    return s + amount * (1 - commission / 100);
  }, 0);

  // The client→task submenu picker (see TaskPicker/show_task_picker_menu)
  // only kicks in once there's more than one client to choose between —
  // see computeVisibleClients in utils.ts.
  const visibleClients = computeVisibleClients(clients, tasks);
  // The sub-label under each task's name, unlike the picker above, always
  // shows for a task on a named client — regardless of how many clients
  // currently exist — so "which client is this task under" never depends
  // on whether a second client happens to exist yet.
  const clientLabelByTaskId: Record<string, string> = {};
  // Today's client sub-label gets a small dot in the client's avatar
  // color next to it — only when that client actually has one (i.e. its
  // avatar is in emoji mode, see ClientAvatar.tsx; a letter/dash avatar
  // has no real "color" of its own, colors.inputBg isn't one). Isolated
  // from clientLabelByTaskId on purpose — MainContent doesn't get this.
  const clientDotColorByTaskId: Record<string, string> = {};
  tasks.forEach((t) => {
    const client = clients.find((c) => c.id === resolveClientId(t, defaultClientId));
    // Keyed on whether the client actually has a name, not on isDefault —
    // a renamed default client ("No client" -> a real name, see
    // ClientScreen) must start showing its label too, and isDefault never
    // flips back off for it (see backfillClients in db.ts).
    if (client && client.name && client.name.trim()) {
      clientLabelByTaskId[t.id] = clientDisplayName(client);
      if (client.avatarEmoji) clientDotColorByTaskId[t.id] = client.avatarColor ?? AVATAR_COLORS[0];
    }
  });
  const clientGroups = visibleClients.length >= 2
    ? visibleClients
        .map((c) => ({ label: clientDisplayName(c), tasks: tasks.filter((t) => resolveClientId(t, defaultClientId) === c.id) }))
        .filter((g) => g.tasks.length > 0)
    : null;

  return (
    <div style={{ width: 440, height: "100vh", background: colors.pageBg, fontFamily: "'Inter', sans-serif", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", background: "#181A2C", color: "white", borderRadius: 8, padding: "8px 16px", fontSize: 14, fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap", zIndex: 999, pointerEvents: "none", opacity: toastVisible ? 1 : 0, transition: "opacity 0.25s ease" }}>
        Report copied
      </div>
      {mainViewMode === "compact" ? (
        <div>
          <TitleBarButtons isCompact onToggleView={() => setMainViewMode((m) => (m === "compact" ? "full" : "compact"))} focusActive={focusActive} focusStartedAtMs={focusStartedAtMs} focusDurationMs={focusDurationMs} focusMinutes={settings.focusMinutes} onFocusToggle={toggleFocus} />
          <Timer isActive={isActive} elapsedSeconds={elapsedSeconds} onToggle={handleToggle} onTimeClick={() => setScreen("editActiveEntry")} tasks={tasks} clientGroups={clientGroups} selectedTaskId={selectedTaskId} onTaskSelect={(id) => setSelectedTaskId(id)} focusActive={focusActive} focusStartedAtMs={focusStartedAtMs} focusDurationMs={focusDurationMs} />
          <CompactProgress last7Entries={last7Entries} settings={settings} isActive={isActive} elapsedSeconds={elapsedSeconds} />
        </div>
      ) : (
        <>
          <TitleBarButtons isCompact={false} onToggleView={() => setMainViewMode((m) => (m === "compact" ? "full" : "compact"))} focusActive={focusActive} focusStartedAtMs={focusStartedAtMs} focusDurationMs={focusDurationMs} focusMinutes={settings.focusMinutes} onFocusToggle={toggleFocus} />
          {/* paddingTop: 6 — permanent headroom for Timer's focus ring (see
              FocusRing in Timer.tsx), which pokes 6px above the Play/Stop
              button. Without it, this container's own overflow-y clips the
              ring's top edge since Timer sits flush against it. */}
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", scrollbarWidth: "none", paddingTop: 6 }}>
            <Timer isActive={isActive} elapsedSeconds={elapsedSeconds} onToggle={handleToggle} onTimeClick={() => setScreen("editActiveEntry")} tasks={tasks} clientGroups={clientGroups} selectedTaskId={selectedTaskId} onTaskSelect={(id) => setSelectedTaskId(id)} focusActive={focusActive} focusStartedAtMs={focusStartedAtMs} focusDurationMs={focusDurationMs} />
            <div style={{
              margin: "8px 8px 12px",
              background: colors.cardBg,
              borderRadius: 12,
              padding: 8,
              boxSizing: "border-box",
            }}>
              <TodaySection last7Entries={last7Entries} settings={settings} activeTaskId={selectedTaskId} isActive={isActive} elapsedSeconds={elapsedSeconds} clientLabelByTaskId={clientLabelByTaskId} clientDotColorByTaskId={clientDotColorByTaskId} onTaskClick={(taskId, date) => { setEditEntriesOverride(null); setSelectedEditTaskId(taskId); setSelectedEditDate(date); setScreen("editTimeEntry"); }} onTaskStart={handleTaskStart} />
            </div>
            <div style={{ padding: "0 8px" }}>
              <MainContent
                recentEntries={recentEntries}
                clientLabelByTaskId={clientLabelByTaskId}
                clientDotColorByTaskId={clientDotColorByTaskId}
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
                <span style={{ fontSize: 15, color: colors.textPrimary, lineHeight: "24px", fontFamily: "'Inter', sans-serif", fontVariantNumeric: "tabular-nums" }}>{formatAmount(todayAmount, currency)}</span>
              </Tooltip>
            </div>
            <div style={{ width: 96, display: "flex", justifyContent: "flex-end" }}>
              <Tooltip content="Earned this week">
                <span style={{ fontSize: 15, color: colors.textPrimary, lineHeight: "24px", fontFamily: "'Inter', sans-serif", fontVariantNumeric: "tabular-nums" }}>{formatAmount(weekAmount, currency)}</span>
              </Tooltip>
            </div>
            <div style={{ width: 96, display: "flex", justifyContent: "flex-end" }}>
              <Tooltip
                content={
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span>Earned this month</span>
                    <span>Net of commission: {formatAmount(monthNetAmount, currency)}</span>
                  </div>
                }
              >
                <span style={{ fontSize: 15, fontWeight: 500, color: colors.textPrimary, lineHeight: "24px", fontFamily: "'Inter', sans-serif", fontVariantNumeric: "tabular-nums" }}>{formatAmount(monthAmount, currency)}</span>
              </Tooltip>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
