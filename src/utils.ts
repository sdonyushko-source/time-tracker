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
