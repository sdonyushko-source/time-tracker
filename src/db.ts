import Database from "@tauri-apps/plugin-sql";

let _db: Database | null = null;
// Memoizes the in-flight init so concurrent/repeated initDB() calls (React
// StrictMode double-invokes effects in dev, and a Vite HMR reload can fire
// another mount before the first finishes) all await the same run instead
// of each racing through backfillClients()'s "table is still empty" check
// before any of them has inserted — that race is what let duplicate
// default/beSirius clients slip past the guard.
let _initPromise: Promise<void> | null = null;

async function getDB(): Promise<Database> {
  if (!_db) await initDB();
  return _db!;
}

export interface Settings {
  currency: string;
  dailyGoalSeconds: number;
  dailyGoalEnabled: boolean;
  dailyGoalType: "hours" | "money";
  dailyGoalMoney: number;
  roundReportMinutes: number;
  theme: "system" | "light" | "dark";
  // 0 = Off — no Toggle for this one (see SettingsScreen), same convention
  // as roundReportMinutes above.
  focusMinutes: number;
  // Safety net, not a daily limit: one continuous running session auto-stops
  // after this long regardless of plannedEndTime (see TimeEntry below) —
  // whichever of the two the entry hits first. 0 = Off.
  maxSessionHours: number;
}

export interface Task {
  id: string;
  name: string;
  archived: number;
  createdAt: string;
  // NULL means "the default client" (Client.isDefault=1) — see
  // resolveClientId() in utils.ts. Never write NULL explicitly for a task
  // deliberately assigned to a named client; only the backfill/default path
  // leaves it unset.
  clientId: string | null;
}

// Billing lives here now, not in Settings — a task's rate/commission is
// whichever client it's assigned to (or the default client, for
// clientId=NULL tasks). isPaid=0 clients never contribute to any $ total.
export interface Client {
  id: string;
  // NULL/'' on the default client renders as "No client" — see
  // clientDisplayName() in utils.ts.
  name: string | null;
  isPaid: number;
  rate: number;
  commission: number;
  // Exactly one row has isDefault=1 — the catch-all every clientId-less task
  // belongs to. Never deleted, never duplicated (see initDB's backfill).
  isDefault: number;
  createdAt: string;
  // NULL on both = letter/dash avatar (today's only look, and every
  // existing client's state pre-avatars — see initDB's newClientColumns).
  // avatarColor only matters for rendering once avatarEmoji is also set —
  // see ClientAvatar.tsx.
  avatarColor: string | null;
  avatarEmoji: string | null;
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
  // Set only while this entry is still running (endTime IS NULL) via
  // EditActiveEntryScreen — an absolute ISO instant already resolved past
  // any midnight rollover, not a bare "HH:MM". NULL means no planned end;
  // the entry runs until manual Stop (or the maxSessionHours safety net —
  // see computeAutoStopDeadline in utils.ts).
  plannedEndTime: string | null;
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

export function initDB(): Promise<void> {
  if (!_initPromise) _initPromise = doInitDB();
  return _initPromise;
}

async function doInitDB(): Promise<void> {
  _db = await Database.load("sqlite:time-tracker.db");
  await _db.execute(`CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY DEFAULT 1, hourlyRate REAL, currency TEXT, dailyGoalSeconds INTEGER)`);
  await _db.execute(`CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, name TEXT NOT NULL, archived INTEGER DEFAULT 0, createdAt TEXT NOT NULL)`);
  await _db.execute(`CREATE TABLE IF NOT EXISTS time_entries (id TEXT PRIMARY KEY, taskId TEXT NOT NULL, taskNameSnapshot TEXT, date TEXT, startTime TEXT, endTime TEXT, durationSeconds INTEGER, hourlyRateSnapshot REAL, currencySnapshot TEXT, createdAt TEXT, updatedAt TEXT)`);
  await _db.execute(`CREATE TABLE IF NOT EXISTS schedules (id TEXT PRIMARY KEY, taskId TEXT NOT NULL, taskNameSnapshot TEXT, weekdays TEXT NOT NULL, startTime TEXT NOT NULL, durationMinutes INTEGER NOT NULL, autoStart INTEGER DEFAULT 0, createdAt TEXT NOT NULL)`);
  await _db.execute(`CREATE TABLE IF NOT EXISTS clients (id TEXT PRIMARY KEY, name TEXT, isPaid INTEGER DEFAULT 1, rate REAL DEFAULT 0, commission REAL DEFAULT 0, isDefault INTEGER DEFAULT 0, createdAt TEXT NOT NULL)`);

  // CREATE TABLE IF NOT EXISTS doesn't retrofit columns onto an already-existing
  // settings table, so add newer columns individually and ignore "already exists".
  const newSettingsColumns: [string, string][] = [
    ["dailyGoalEnabled", "INTEGER DEFAULT 1"],
    ["dailyGoalType", "TEXT DEFAULT 'hours'"],
    ["dailyGoalMoney", "REAL DEFAULT 0"],
    ["roundReportMinutes", "INTEGER DEFAULT 10"],
    ["theme", "TEXT DEFAULT 'system'"],
    ["commission", "REAL DEFAULT 0"],
    ["focusMinutes", "INTEGER DEFAULT 25"],
    ["maxSessionHours", "INTEGER DEFAULT 10"],
  ];
  for (const [name, def] of newSettingsColumns) {
    try {
      await _db.execute(`ALTER TABLE settings ADD COLUMN ${name} ${def}`);
    } catch {
      // column already exists
    }
  }

  const newTaskColumns: [string, string][] = [["clientId", "TEXT"]];
  for (const [name, def] of newTaskColumns) {
    try {
      await _db.execute(`ALTER TABLE tasks ADD COLUMN ${name} ${def}`);
    } catch {
      // column already exists
    }
  }

  const newTimeEntryColumns: [string, string][] = [["plannedEndTime", "TEXT"]];
  for (const [name, def] of newTimeEntryColumns) {
    try {
      await _db.execute(`ALTER TABLE time_entries ADD COLUMN ${name} ${def}`);
    } catch {
      // column already exists
    }
  }

  // NULL on both for every existing client = today's letter/dash avatar,
  // unchanged — no backfill needed, see Client.avatarColor/avatarEmoji.
  const newClientColumns: [string, string][] = [
    ["avatarColor", "TEXT"],
    ["avatarEmoji", "TEXT"],
  ];
  for (const [name, def] of newClientColumns) {
    try {
      await _db.execute(`ALTER TABLE clients ADD COLUMN ${name} ${def}`);
    } catch {
      // column already exists
    }
  }

  await backfillClients(_db);
}

// One-time migration into the clients feature — guarded by "clients table is
// still empty" so it's a no-op (and idempotent) on every run after the
// first. Never touches time_entries: hourlyRateSnapshot/currencySnapshot
// already froze each past entry's amount at tracking time, so nothing about
// historical totals can change here. Tasks are updated via UPDATE, not
// delete+insert, so task ids (and every entry's taskId) stay intact.
async function backfillClients(db: Database): Promise<void> {
  const existing = await db.select<{ count: number }[]>("SELECT COUNT(*) as count FROM clients");
  if ((existing[0]?.count ?? 0) > 0) return;

  const settingsRows = await db.select<{ hourlyRate: number | null; commission: number | null }[]>(
    "SELECT hourlyRate, commission FROM settings WHERE id = 1"
  );
  const rate = settingsRows[0]?.hourlyRate ?? 30;
  const commission = settingsRows[0]?.commission ?? 0;
  const now = new Date().toISOString();

  const defaultId = crypto.randomUUID();
  await db.execute(
    `INSERT INTO clients (id, name, isPaid, rate, commission, isDefault, createdAt) VALUES (?, NULL, 1, ?, ?, 1, ?)`,
    [defaultId, rate, commission, now]
  );

  const beSiriusId = crypto.randomUUID();
  await db.execute(
    `INSERT INTO clients (id, name, isPaid, rate, commission, isDefault, createdAt) VALUES (?, 'beSirius', 1, ?, ?, 0, ?)`,
    [beSiriusId, rate, commission, now]
  );

  await db.execute("UPDATE tasks SET clientId = ?", [beSiriusId]);
}

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

// hourlyRate/commission still exist as columns on the underlying settings
// row (from before rate moved to Client) — never read/written here anymore,
// left in place rather than dropped (see the no-migrations rule at the top
// of initDB).
export async function getSettings(): Promise<Settings> {
  const db = await getDB();
  const rows = await db.select<Record<string, unknown>[]>(
    "SELECT currency, dailyGoalSeconds, dailyGoalEnabled, dailyGoalType, dailyGoalMoney, roundReportMinutes, theme, focusMinutes, maxSessionHours FROM settings WHERE id = 1"
  );
  if (!rows.length) {
    await db.execute(
      `INSERT OR IGNORE INTO settings
         (id, currency, dailyGoalSeconds, dailyGoalEnabled, dailyGoalType, dailyGoalMoney, roundReportMinutes, theme, focusMinutes, maxSessionHours)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        DEFAULT_SETTINGS.currency, DEFAULT_SETTINGS.dailyGoalSeconds,
        DEFAULT_SETTINGS.dailyGoalEnabled ? 1 : 0, DEFAULT_SETTINGS.dailyGoalType, DEFAULT_SETTINGS.dailyGoalMoney,
        DEFAULT_SETTINGS.roundReportMinutes, DEFAULT_SETTINGS.theme, DEFAULT_SETTINGS.focusMinutes,
        DEFAULT_SETTINGS.maxSessionHours,
      ]
    );
    return DEFAULT_SETTINGS;
  }
  const r = rows[0];
  return {
    currency: (r.currency as string) ?? DEFAULT_SETTINGS.currency,
    dailyGoalSeconds: (r.dailyGoalSeconds as number) ?? DEFAULT_SETTINGS.dailyGoalSeconds,
    dailyGoalEnabled: r.dailyGoalEnabled == null ? DEFAULT_SETTINGS.dailyGoalEnabled : !!r.dailyGoalEnabled,
    dailyGoalType: r.dailyGoalType === "money" ? "money" : "hours",
    dailyGoalMoney: (r.dailyGoalMoney as number) ?? DEFAULT_SETTINGS.dailyGoalMoney,
    roundReportMinutes: (r.roundReportMinutes as number) ?? DEFAULT_SETTINGS.roundReportMinutes,
    theme: r.theme === "light" || r.theme === "dark" ? r.theme : "system",
    focusMinutes: (r.focusMinutes as number) ?? DEFAULT_SETTINGS.focusMinutes,
    maxSessionHours: (r.maxSessionHours as number) ?? DEFAULT_SETTINGS.maxSessionHours,
  };
}

export async function saveSettings(s: Settings): Promise<void> {
  const db = await getDB();
  await db.execute(
    `UPDATE settings SET currency = ?, dailyGoalSeconds = ?, dailyGoalEnabled = ?, dailyGoalType = ?, dailyGoalMoney = ?, roundReportMinutes = ?, theme = ?, focusMinutes = ?, maxSessionHours = ? WHERE id = 1`,
    [
      s.currency, s.dailyGoalSeconds,
      s.dailyGoalEnabled ? 1 : 0, s.dailyGoalType, s.dailyGoalMoney,
      s.roundReportMinutes, s.theme, s.focusMinutes, s.maxSessionHours,
    ]
  );
}

export async function getTasks(): Promise<Task[]> {
  const db = await getDB();
  return db.select<Task[]>(
    "SELECT id, name, archived, createdAt, clientId FROM tasks WHERE archived = 0 ORDER BY createdAt DESC"
  );
}

// Same as getTasks but including archived ones — for historical reporting
// (client monthly totals, App.tsx's commission math) where an entry from a
// since-deleted task must still resolve to the right client.
export async function getAllTasks(): Promise<Task[]> {
  const db = await getDB();
  return db.select<Task[]>("SELECT id, name, archived, createdAt, clientId FROM tasks ORDER BY createdAt DESC");
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

// clientId=null (the default) leaves the task on the default client — same
// as every task already sitting there before the clients feature existed.
export async function createTask(name: string, clientId: string | null = null): Promise<string> {
  const db = await getDB();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.execute(
    "INSERT INTO tasks (id, name, archived, createdAt, clientId) VALUES (?, ?, 0, ?, ?)",
    [id, name, now, clientId]
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

export async function getClients(): Promise<Client[]> {
  const db = await getDB();
  return db.select<Client[]>("SELECT * FROM clients ORDER BY isDefault ASC, createdAt ASC");
}

export async function createClient(
  name: string,
  isPaid: boolean,
  rate: number,
  commission: number,
  avatarColor: string | null,
  avatarEmoji: string | null
): Promise<string> {
  const db = await getDB();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.execute(
    `INSERT INTO clients (id, name, isPaid, rate, commission, isDefault, createdAt, avatarColor, avatarEmoji) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)`,
    [id, name, isPaid ? 1 : 0, rate, commission, now, avatarColor, avatarEmoji]
  );
  return id;
}

// Also used to turn the default client into a named one (giving it a
// name) — isDefault itself is never changed here, only by backfill.
export async function updateClient(
  id: string,
  name: string | null,
  isPaid: boolean,
  rate: number,
  commission: number,
  avatarColor: string | null,
  avatarEmoji: string | null
): Promise<void> {
  const db = await getDB();
  await db.execute(
    `UPDATE clients SET name = ?, isPaid = ?, rate = ?, commission = ?, avatarColor = ?, avatarEmoji = ? WHERE id = ?`,
    [name, isPaid ? 1 : 0, rate, commission, avatarColor, avatarEmoji, id]
  );
}

// Never deletes tasks or time_entries — this client's tasks move to the
// default client (clientId = NULL, same as any other clientId-less task)
// first, so every task and every entry it ever tracked stays exactly where
// it was; only the client record itself, and the client-only grouping,
// goes away. isDefault=1 is excluded from the WHERE so the default client
// itself can never be deleted through this path (the UI never offers the
// button for it either — see ClientScreen).
export async function deleteClient(id: string): Promise<void> {
  const db = await getDB();
  await db.execute("UPDATE tasks SET clientId = NULL WHERE clientId = ?", [id]);
  await db.execute("DELETE FROM clients WHERE id = ? AND isDefault = 0", [id]);
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
