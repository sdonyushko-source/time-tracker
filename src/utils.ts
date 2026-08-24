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
}

interface ReportOptions {
  rate: number;
  currency: string;
  roundReportMinutes: number;
}

// Builds the "Copy monthly report" clipboard text: date range, total time,
// comma-separated per-task breakdown, then total earned. Shared between the
// current month (App.tsx) and any past month (HistoryScreen.tsx).
export function buildMonthlyReportText(entries: ReportEntry[], dateRange: string, { rate, currency, roundReportMinutes }: ReportOptions): string {
  const roundUnit = (roundReportMinutes || 0) * 60;
  const roundDuration = (secs: number) => (roundUnit ? Math.round(secs / roundUnit) * roundUnit : secs);

  const taskMap: Record<string, { name: string; seconds: number }> = {};
  entries.forEach((e) => {
    if (!taskMap[e.taskId]) taskMap[e.taskId] = { name: e.taskNameSnapshot, seconds: 0 };
    taskMap[e.taskId].seconds += roundDuration(e.durationSeconds ?? 0);
  });

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

  return [dateRange, fmtHM(totalSeconds), taskLines.join(", "), fmtAmount(totalSeconds)].join("\n");
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
