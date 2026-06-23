import Database from "@tauri-apps/plugin-sql";
import { localDateString, getWeekStart, getMonthStart } from "./utils";

let _db: Database | null = null;

async function getDb(): Promise<Database> {
  if (!_db) _db = await Database.load("sqlite:time-tracker.db");
  return _db;
}

export interface Settings {
  hourlyRate: number;
  currency: string;
  dailyGoalSeconds: number;
}

export interface Task {
  id: string;
  name: string;
  archived: number;
  createdAt: string;
}

export interface TimeEntry {
  id: string;
  taskId: string;
  taskNameSnapshot: string;
  date: string;
  startTime: string;
  endTime: string | null;
  durationSeconds: number | null;
  hourlyRateSnapshot: number | null;
  currencySnapshot: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TodayTask {
  taskId: string;
  taskName: string;
  totalSeconds: number;
}

export interface SummaryRow {
  label: string;
  seconds: number;
  amount: number;
  bold: boolean;
}

export async function getSettings(): Promise<Settings> {
  const db = await getDb();
  const rows = await db.select<Settings[]>(
    "SELECT hourlyRate, currency, dailyGoalSeconds FROM settings WHERE id = 1"
  );
  if (!rows.length) {
    await db.execute(
      "INSERT OR IGNORE INTO settings (id, hourlyRate, currency, dailyGoalSeconds) VALUES (1, 30, 'USD', 28800)"
    );
    return { hourlyRate: 30, currency: "USD", dailyGoalSeconds: 28800 };
  }
  return rows[0];
}

export async function saveSettings(s: Settings): Promise<void> {
  const db = await getDb();
  await db.execute(
    "INSERT OR REPLACE INTO settings (id, hourlyRate, currency, dailyGoalSeconds) VALUES (1, ?, ?, ?)",
    [s.hourlyRate, s.currency, s.dailyGoalSeconds]
  );
}

export async function getTasks(): Promise<Task[]> {
  const db = await getDb();
  return db.select<Task[]>(
    "SELECT id, name, archived, createdAt FROM tasks WHERE archived = 0 ORDER BY createdAt DESC"
  );
}

export async function createTask(name: string): Promise<string> {
  const db = await getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.execute(
    "INSERT INTO tasks (id, name, archived, createdAt) VALUES (?, ?, 0, ?)",
    [id, name, now]
  );
  return id;
}

export async function getTodayTasks(): Promise<TodayTask[]> {
  const db = await getDb();
  const today = localDateString();
  return db.select<TodayTask[]>(
    `SELECT taskId, taskNameSnapshot as taskName, SUM(durationSeconds) as totalSeconds
     FROM time_entries
     WHERE date = ? AND durationSeconds IS NOT NULL
     GROUP BY taskId, taskNameSnapshot
     ORDER BY totalSeconds DESC`,
    [today]
  );
}

export async function getOpenEntry(): Promise<TimeEntry | null> {
  const db = await getDb();
  const rows = await db.select<TimeEntry[]>(
    "SELECT * FROM time_entries WHERE endTime IS NULL ORDER BY createdAt DESC LIMIT 1"
  );
  return rows[0] ?? null;
}

export async function startEntry(
  taskId: string,
  taskName: string,
  hourlyRate: number,
  currency: string
): Promise<string> {
  const db = await getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const today = localDateString();
  await db.execute(
    `INSERT INTO time_entries
       (id, taskId, taskNameSnapshot, date, startTime, endTime, durationSeconds,
        hourlyRateSnapshot, currencySnapshot, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?)`,
    [id, taskId, taskName, today, now, hourlyRate, currency, now, now]
  );
  return id;
}

export async function stopEntry(entryId: string): Promise<void> {
  const db = await getDb();
  const rows = await db.select<{ startTime: string }[]>(
    "SELECT startTime FROM time_entries WHERE id = ?",
    [entryId]
  );
  if (!rows.length) return;
  const now = new Date().toISOString();
  const duration = Math.round(
    (new Date(now).getTime() - new Date(rows[0].startTime).getTime()) / 1000
  );
  await db.execute(
    "UPDATE time_entries SET endTime = ?, durationSeconds = ?, updatedAt = ? WHERE id = ?",
    [now, duration, now, entryId]
  );
}

export async function getSummary(hourlyRate: number): Promise<SummaryRow[]> {
  const db = await getDb();
  const today = localDateString();
  const weekStart = getWeekStart();
  const monthStart = getMonthStart();

  const rows = await db.select<{ period: string; total: number }[]>(
    `SELECT
       CASE
         WHEN date = ? THEN 'today'
         WHEN date >= ? THEN 'week_rest'
         ELSE 'month_rest'
       END as period,
       SUM(durationSeconds) as total
     FROM time_entries
     WHERE date >= ? AND durationSeconds IS NOT NULL
     GROUP BY period`,
    [today, weekStart, monthStart]
  );

  const map: Record<string, number> = {};
  rows.forEach((r) => {
    if (r.period) map[r.period] = Number(r.total);
  });

  const todaySec = map["today"] ?? 0;
  const weekSec = todaySec + (map["week_rest"] ?? 0);
  const monthSec = weekSec + (map["month_rest"] ?? 0);

  return [
    { label: "Today", seconds: todaySec, amount: (todaySec / 3600) * hourlyRate, bold: false },
    { label: "This week", seconds: weekSec, amount: (weekSec / 3600) * hourlyRate, bold: false },
    { label: "This month", seconds: monthSec, amount: (monthSec / 3600) * hourlyRate, bold: true },
  ];
}

export async function getHistory(limit = 100): Promise<TimeEntry[]> {
  const db = await getDb();
  return db.select<TimeEntry[]>(
    "SELECT * FROM time_entries WHERE durationSeconds IS NOT NULL ORDER BY date DESC, startTime DESC LIMIT ?",
    [limit]
  );
}
