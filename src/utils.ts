export function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

// H:MM without leading zero on hours, no seconds. e.g. 21905 → "6:05", 84 → "0:01"
export function formatTimeHM(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h + ":" + String(m).padStart(2, "0");
}

// Russian short format: "Xч Yм" / "Xч" / "Yм"
export function formatTimeRU(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}ч ${m}м`;
  if (h > 0) return `${h}ч`;
  return `${m}м`;
}

// English short format: "Xh Ym" / "Xh" / "Ym" — used in auto-stop
// notifications/hints, which are worded in English (unlike the ч/м goal
// readouts above, which are this app's own separate established shorthand
// for the progress bar specifically).
export function formatDurationEN(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

// "HH:MM" from a timestamp, local time.
export function formatHM(ms: number): string {
  const d = new Date(ms);
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}

export type AutoStopReason = "planned" | "maxSession";

export interface AutoStopDeadline {
  deadlineMs: number;
  reason: AutoStopReason;
}

// The nearer of a specific planned end time and the max-session-length
// safety net, whichever the running entry hits first — null when neither
// applies (no plannedEndTime set and maxSessionHours is 0/Off). Ties go to
// "planned": a deliberately-set end time is the more specific signal.
export function computeAutoStopDeadline(
  startMs: number,
  plannedEndTime: string | null,
  maxSessionHours: number
): AutoStopDeadline | null {
  const plannedMs = plannedEndTime ? new Date(plannedEndTime).getTime() : null;
  const maxMs = maxSessionHours > 0 ? startMs + maxSessionHours * 3600 * 1000 : null;

  if (plannedMs === null && maxMs === null) return null;
  if (plannedMs !== null && (maxMs === null || plannedMs <= maxMs)) {
    return { deadlineMs: plannedMs, reason: "planned" };
  }
  return { deadlineMs: maxMs!, reason: "maxSession" };
}

export interface GoalProgress {
  totalSeconds: number;
  // Rounded, uncapped — 125 past goal, not pinned at 100 (matches the label).
  pct: number;
  // All four are % widths (0-100) for same-height flex segments laid out
  // left to right in this order: green, ghost, orange, ghostOver. Any of
  // them can be 0. Ghost segments render as the same gradient as their
  // solid counterpart, just at reduced opacity — see TodaySection/
  // CompactProgress — never a distinct color: it's the same time, just not
  // closed yet.
  green: number;
  ghost: number;
  orange: number;
  ghostOver: number;
}

// Shared by TodaySection and CompactProgress: today's total against the
// daily goal, split into closed time (green/orange, from last7Entries) and
// the still-running entry's live elapsed time (ghost/ghostOver, from
// elapsedSeconds — it has no durationSeconds yet, so it can't come from
// last7Entries at all). Under goal, segments are simple fractions of the
// goal; over goal the bar is always full and every segment's share is
// recomputed against the actual total instead, so a longer day doesn't
// change what "100% of the bar" means.
export function computeGoalProgress(closedSeconds: number, runningSeconds: number, goalSeconds: number): GoalProgress {
  const totalSeconds = closedSeconds + runningSeconds;
  const pct = goalSeconds > 0 ? Math.round((totalSeconds / goalSeconds) * 100) : 0;

  if (goalSeconds <= 0) {
    return { totalSeconds, pct, green: 0, ghost: 0, orange: 0, ghostOver: 0 };
  }

  if (totalSeconds <= goalSeconds) {
    return {
      totalSeconds,
      pct,
      green: (closedSeconds / goalSeconds) * 100,
      ghost: (runningSeconds / goalSeconds) * 100,
      orange: 0,
      ghostOver: 0,
    };
  }

  const remainingGoalRoom = Math.max(0, goalSeconds - closedSeconds);
  const runningWithinGoal = Math.min(runningSeconds, remainingGoalRoom);
  const runningOverGoal = runningSeconds - runningWithinGoal;
  return {
    totalSeconds,
    pct,
    green: (Math.min(closedSeconds, goalSeconds) / totalSeconds) * 100,
    ghost: (runningWithinGoal / totalSeconds) * 100,
    orange: (Math.max(0, closedSeconds - goalSeconds) / totalSeconds) * 100,
    ghostOver: (runningOverGoal / totalSeconds) * 100,
  };
}

export function formatAmount(amount: number, currency: string): string {
  const symbol = currency === "USD" ? "$" : currency === "EUR" ? "€" : currency === "GBP" ? "£" : currency + " ";
  return symbol + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function localDateString(): string {
  const now = new Date();
  return (
    now.getFullYear() +
    "-" +
    String(now.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(now.getDate()).padStart(2, "0")
  );
}

export function getWeekStart(): string {
  const now = new Date();
  const diff = (now.getDay() + 6) % 7;
  const d = new Date(now);
  d.setDate(d.getDate() - diff);
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

export function getMonthStart(): string {
  const now = new Date();
  return now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-01";
}

interface ReportEntry {
  taskId: string;
  taskNameSnapshot: string;
  durationSeconds: number | null;
  hourlyRateSnapshot: number | null;
}

interface ReportOptions {
  currency: string;
  roundReportMinutes: number;
}

// Builds the "Copy monthly report" clipboard text: date range, total time,
// comma-separated per-task breakdown, then total earned. Shared between the
// current month (App.tsx) and any past month (HistoryScreen.tsx).
//
// Earned amount is summed from each entry's own hourlyRateSnapshot rather
// than one flat rate — rate now lives per-client (see Client in db.ts), so
// entries tracked under different clients (or at a rate later changed) never
// shared a single number to begin with.
export function buildMonthlyReportText(entries: ReportEntry[], dateRange: string, { currency, roundReportMinutes }: ReportOptions): string {
  const roundUnit = (roundReportMinutes || 0) * 60;
  const roundDuration = (secs: number) => (roundUnit ? Math.round(secs / roundUnit) * roundUnit : secs);

  const taskMap: Record<string, { name: string; seconds: number }> = {};
  let totalAmount = 0;
  entries.forEach((e) => {
    if (!taskMap[e.taskId]) taskMap[e.taskId] = { name: e.taskNameSnapshot, seconds: 0 };
    const rounded = roundDuration(e.durationSeconds ?? 0);
    taskMap[e.taskId].seconds += rounded;
    totalAmount += (rounded / 3600) * (e.hourlyRateSnapshot ?? 0);
  });

  const fmtHM = (secs: number) => {
    const totalMin = Math.ceil(secs / 60);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return m === 0 ? `${h}h` : `${h}h ${String(m).padStart(2, "0")}m`;
  };

  const fmtAmount = (amount: number) => {
    const symbol = currency === "USD" ? "$" : currency === "EUR" ? "€" : currency === "GBP" ? "£" : currency + " ";
    return `${amount.toFixed(0)}${symbol}`;
  };

  let totalSeconds = 0;
  const taskLines: string[] = [];
  Object.values(taskMap).forEach(({ name, seconds }) => {
    taskLines.push(`${name} – ${fmtHM(seconds)}`);
    totalSeconds += seconds;
  });

  return [dateRange, fmtHM(totalSeconds), taskLines.join(", "), fmtAmount(totalAmount)].join("\n");
}

export async function copyTextToClipboard(text: string): Promise<void> {
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
}

// "1–31 Jul" for the given year-month ("2026-07").
export function formatMonthDateRange(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const monthName = new Date(y, m - 1, 1).toLocaleString("en-US", { month: "short" });
  return `1–${lastDay} ${monthName}`;
}

interface ClientLike { id: string; name: string | null; isDefault: number }
interface TaskLike { id: string; clientId: string | null | undefined; archived?: number }

// A task's clientId is only set for tasks explicitly assigned to a named
// client — everything else (clientId NULL) belongs to the default client.
export function resolveClientId<T extends TaskLike>(task: T, defaultClientId: string): string {
  return task.clientId ?? defaultClientId;
}

// NULL/empty name is only meaningful on the default client (isDefault=1) —
// that's what renders as "No client" everywhere in the UI.
export function clientDisplayName<C extends ClientLike>(client: C): string {
  return client.name && client.name.trim() ? client.name : "No client";
}

// Clients the UI should ever show as a distinct entity: every named client,
// plus the default client but ONLY if at least one (non-archived) task is
// still sitting in it unassigned. Screens gate flat-list vs. clients-list
// display, and whether to show a per-task client sub-label, on this same
// list's length (<=1 vs >=2) — one definition shared everywhere so the
// threshold can't drift between screens.
export function computeVisibleClients<C extends ClientLike, T extends TaskLike>(clients: C[], tasks: T[]): C[] {
  const defaultClient = clients.find((c) => c.isDefault);
  const named = clients.filter((c) => !c.isDefault);
  if (!defaultClient) return named;
  const defaultHasTasks = tasks.some((t) => !t.archived && resolveClientId(t, defaultClient.id) === defaultClient.id);
  return defaultHasTasks ? [...named, defaultClient] : named;
}
