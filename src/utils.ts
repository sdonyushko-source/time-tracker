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
