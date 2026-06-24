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
  await _db.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      hourlyRate REAL,
      currency TEXT,
      dailyGoalSeconds INTEGER
    )
  `);
  await _db.execute(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      archived INTEGER DEFAULT 0,
      createdAt TEXT NOT NULL
    )
  `);
  await _db.execute(`
    CREATE TABLE IF NOT EXISTS time_entries (
      id TEXT PRIMARY KEY,
      taskId TEXT NOT NULL,
      taskNameSnapshot TEXT,
      date TEXT,
      startTime TEXT,
      endTime TEXT,
      durationSeconds INTEGER,
      hourlyRateSnapshot REAL,
      currencySnapshot TEXT,
      createdAt TEXT,
      updatedAt TEXT
    )
  `);
}

export async function getSettings(): Promise<Settings> {
  const db = await getDB();
  const rows = await db.select<Settings[]>(
    "SELECT hourlyRate, currency, dailyGoalSeconds FROM settings WHERE id = 1"
  );
  if (!rows.length) {
    await db.execute(
      "INSERT OR IGNORE INTO settings (id, hourlyRate, currency, dailyGoalSeconds) VALUES (1, 30, 'USD', 21600)"
    );
    return { hourlyRate: 30, currency: "USD", dailyGoalSeconds: 21600 };
  }
  return rows[0];
}

export async function saveSettings(s: Settings): Promise<void> {
  const db = await getDB();
  await db.execute(
    "INSERT OR REPLACE INTO settings (id, hourlyRate, currency, dailyGoalSeconds) VALUES (1, ?, ?, ?)",
    [s.hourlyRate, s.currency, s.dailyGoalSeconds]
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
