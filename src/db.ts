import Database from "@tauri-apps/plugin-sql";

let _db: Database | null = null;

async function getDB(): Promise<Database> {
  if (!_db) await initDB();
  return _db!;
}

export interface Settings {
  hourlyRate: number;
  currency: string;
  dailyGoalSeconds: number;
  dailyGoalEnabled: boolean;
  dailyGoalType: "hours" | "money";
  dailyGoalMoney: number;
  roundReportMinutes: number;
  theme: "system" | "light" | "dark";
  // Doesn't affect any calculated amount except the "Net of commission" line
  // in the "Earned this month" footer tooltip — see App.tsx.
  commission: number;
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

export interface Schedule {
  id: string;
  taskId: string;
  // Snapshot, same convention as TimeEntry.taskNameSnapshot — renaming the
  // task later doesn't retroactively change already-created rules.
  taskNameSnapshot: string;
  // Comma-separated day indices, JS Date.getDay() convention (0=Sun..6=Sat)
  // so the schedule checker in App.tsx can compare against getDay() directly
  // without remapping.
  weekdays: string;
  startTime: string; // "HH:MM"
  durationMinutes: number;
  autoStart: number; // 0/1
  createdAt: string;
}

function localDate(): string {
  const d = new Date();
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

function weekStart(): string {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

function monthStart(): string {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-01";
}

export async function initDB(): Promise<void> {
  _db = await Database.load("sqlite:time-tracker.db");
  await _db.execute(`CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY DEFAULT 1, hourlyRate REAL, currency TEXT, dailyGoalSeconds INTEGER)`);
  await _db.execute(`CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, name TEXT NOT NULL, archived INTEGER DEFAULT 0, createdAt TEXT NOT NULL)`);
  await _db.execute(`CREATE TABLE IF NOT EXISTS time_entries (id TEXT PRIMARY KEY, taskId TEXT NOT NULL, taskNameSnapshot TEXT, date TEXT, startTime TEXT, endTime TEXT, durationSeconds INTEGER, hourlyRateSnapshot REAL, currencySnapshot TEXT, createdAt TEXT, updatedAt TEXT)`);
  await _db.execute(`CREATE TABLE IF NOT EXISTS schedules (id TEXT PRIMARY KEY, taskId TEXT NOT NULL, taskNameSnapshot TEXT, weekdays TEXT NOT NULL, startTime TEXT NOT NULL, durationMinutes INTEGER NOT NULL, autoStart INTEGER DEFAULT 0, createdAt TEXT NOT NULL)`);

  // CREATE TABLE IF NOT EXISTS doesn't retrofit columns onto an already-existing
  // settings table, so add newer columns individually and ignore "already exists".
  const newSettingsColumns: [string, string][] = [
    ["dailyGoalEnabled", "INTEGER DEFAULT 1"],
    ["dailyGoalType", "TEXT DEFAULT 'hours'"],
    ["dailyGoalMoney", "REAL DEFAULT 0"],
    ["roundReportMinutes", "INTEGER DEFAULT 10"],
    ["theme", "TEXT DEFAULT 'system'"],
    ["commission", "REAL DEFAULT 0"],
  ];
  for (const [name, def] of newSettingsColumns) {
    try {
      await _db.execute(`ALTER TABLE settings ADD COLUMN ${name} ${def}`);
    } catch {
      // column already exists
    }
  }
}

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

export async function getSettings(): Promise<Settings> {
  const db = await getDB();
  const rows = await db.select<Record<string, unknown>[]>(
    "SELECT hourlyRate, currency, dailyGoalSeconds, dailyGoalEnabled, dailyGoalType, dailyGoalMoney, roundReportMinutes, theme, commission FROM settings WHERE id = 1"
  );
  if (!rows.length) {
    await db.execute(
      `INSERT OR IGNORE INTO settings
         (id, hourlyRate, currency, dailyGoalSeconds, dailyGoalEnabled, dailyGoalType, dailyGoalMoney, roundReportMinutes, theme, commission)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        DEFAULT_SETTINGS.hourlyRate, DEFAULT_SETTINGS.currency, DEFAULT_SETTINGS.dailyGoalSeconds,
        DEFAULT_SETTINGS.dailyGoalEnabled ? 1 : 0, DEFAULT_SETTINGS.dailyGoalType, DEFAULT_SETTINGS.dailyGoalMoney,
        DEFAULT_SETTINGS.roundReportMinutes, DEFAULT_SETTINGS.theme, DEFAULT_SETTINGS.commission,
      ]
    );
    return DEFAULT_SETTINGS;
  }
  const r = rows[0];
  return {
    hourlyRate: (r.hourlyRate as number) ?? DEFAULT_SETTINGS.hourlyRate,
    currency: (r.currency as string) ?? DEFAULT_SETTINGS.currency,
    dailyGoalSeconds: (r.dailyGoalSeconds as number) ?? DEFAULT_SETTINGS.dailyGoalSeconds,
    dailyGoalEnabled: r.dailyGoalEnabled == null ? DEFAULT_SETTINGS.dailyGoalEnabled : !!r.dailyGoalEnabled,
    dailyGoalType: r.dailyGoalType === "money" ? "money" : "hours",
    dailyGoalMoney: (r.dailyGoalMoney as number) ?? DEFAULT_SETTINGS.dailyGoalMoney,
    roundReportMinutes: (r.roundReportMinutes as number) ?? DEFAULT_SETTINGS.roundReportMinutes,
    theme: r.theme === "light" || r.theme === "dark" ? r.theme : "system",
    commission: (r.commission as number) ?? DEFAULT_SETTINGS.commission,
  };
}

export async function saveSettings(s: Settings): Promise<void> {
  const db = await getDB();
  await db.execute(
    `INSERT OR REPLACE INTO settings
       (id, hourlyRate, currency, dailyGoalSeconds, dailyGoalEnabled, dailyGoalType, dailyGoalMoney, roundReportMinutes, theme, commission)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      s.hourlyRate, s.currency, s.dailyGoalSeconds,
      s.dailyGoalEnabled ? 1 : 0, s.dailyGoalType, s.dailyGoalMoney,
      s.roundReportMinutes, s.theme, s.commission,
    ]
  );
}

export async function getTasks(): Promise<Task[]> {
  const db = await getDB();
  return db.select<Task[]>(
    "SELECT id, name, archived, createdAt FROM tasks WHERE archived = 0 ORDER BY createdAt DESC"
  );
}

export async function getTodayEntries(): Promise<TimeEntry[]> {
  const db = await getDB();
  return db.select<TimeEntry[]>(
    "SELECT * FROM time_entries WHERE date = ? ORDER BY startTime DESC",
    [localDate()]
  );
}

export async function getWeekEntries(): Promise<TimeEntry[]> {
  const db = await getDB();
  return db.select<TimeEntry[]>(
    "SELECT * FROM time_entries WHERE date >= ? ORDER BY startTime DESC",
    [weekStart()]
  );
}

export async function getMonthEntries(): Promise<TimeEntry[]> {
  const db = await getDB();
  return db.select<TimeEntry[]>(
    "SELECT * FROM time_entries WHERE date >= ? ORDER BY startTime DESC",
    [monthStart()]
  );
}

export async function startEntry(
  taskId: string,
  taskName: string,
  hourlyRate: number,
  currency: string
): Promise<string> {
  const db = await getDB();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.execute(
    `INSERT INTO time_entries
       (id, taskId, taskNameSnapshot, date, startTime, endTime, durationSeconds,
        hourlyRateSnapshot, currencySnapshot, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?)`,
    [id, taskId, taskName, localDate(), now, hourlyRate, currency, now, now]
  );
  return id;
}

export async function createTask(name: string): Promise<string> {
  const db = await getDB();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.execute(
    "INSERT INTO tasks (id, name, archived, createdAt) VALUES (?, ?, 0, ?)",
    [id, name, now]
  );
  return id;
}

export async function deleteTask(id: string): Promise<void> {
  const db = await getDB();
  await db.execute("UPDATE tasks SET archived = 1 WHERE id = ?", [id]);
}

export async function renameTask(id: string, name: string): Promise<void> {
  const db = await getDB();
  await db.execute("UPDATE tasks SET name = ? WHERE id = ?", [name, id]);
}

export async function getActiveEntry(): Promise<TimeEntry | null> {
  const db = await getDB();
  const rows = await db.select<TimeEntry[]>(
    "SELECT * FROM time_entries WHERE endTime IS NULL ORDER BY startTime DESC LIMIT 1"
  );
  return rows[0] ?? null;
}

export async function getLast7DaysEntries(): Promise<TimeEntry[]> {
  const db = await getDB();
  const d = new Date();
  d.setDate(d.getDate() - 6);
  const from = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  return db.select<TimeEntry[]>("SELECT * FROM time_entries WHERE date >= ? AND endTime IS NOT NULL ORDER BY date DESC, startTime ASC", [from]);
}

// The N most recent past days (before today) that actually have completed
// entries — not the N most recent calendar days, which could include empty
// gaps and under-fill the list. Reaches back past 7 days if needed.
export async function getRecentDaysEntries(days: number): Promise<TimeEntry[]> {
  const db = await getDB();
  return db.select<TimeEntry[]>(
    `SELECT * FROM time_entries WHERE endTime IS NOT NULL AND date IN (
       SELECT DISTINCT date FROM time_entries WHERE endTime IS NOT NULL AND date < ? ORDER BY date DESC LIMIT ?
     ) ORDER BY date DESC, startTime ASC`,
    [localDate(), days]
  );
}

export async function getAllEntries(): Promise<TimeEntry[]> {
  const db = await getDB();
  return db.select<TimeEntry[]>(
    "SELECT * FROM time_entries ORDER BY date DESC, startTime DESC"
  );
}

export async function getSchedules(): Promise<Schedule[]> {
  const db = await getDB();
  return db.select<Schedule[]>("SELECT * FROM schedules ORDER BY createdAt DESC");
}

export async function createSchedule(
  taskId: string,
  taskName: string,
  weekdays: string,
  startTime: string,
  durationMinutes: number,
  autoStart: boolean
): Promise<string> {
  const db = await getDB();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.execute(
    `INSERT INTO schedules (id, taskId, taskNameSnapshot, weekdays, startTime, durationMinutes, autoStart, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, taskId, taskName, weekdays, startTime, durationMinutes, autoStart ? 1 : 0, now]
  );
  return id;
}

export async function updateSchedule(
  id: string,
  taskId: string,
  taskName: string,
  weekdays: string,
  startTime: string,
  durationMinutes: number,
  autoStart: boolean
): Promise<void> {
  const db = await getDB();
  await db.execute(
    `UPDATE schedules SET taskId = ?, taskNameSnapshot = ?, weekdays = ?, startTime = ?, durationMinutes = ?, autoStart = ? WHERE id = ?`,
    [taskId, taskName, weekdays, startTime, durationMinutes, autoStart ? 1 : 0, id]
  );
}

export async function deleteSchedule(id: string): Promise<void> {
  const db = await getDB();
  await db.execute("DELETE FROM schedules WHERE id = ?", [id]);
}

export async function stopEntry(
  id: string,
  endTime: string,
  durationSeconds: number
): Promise<void> {
  const db = await getDB();
  await db.execute(
    "UPDATE time_entries SET endTime = ?, durationSeconds = ?, updatedAt = ? WHERE id = ?",
    [endTime, durationSeconds, new Date().toISOString(), id]
  );
}
