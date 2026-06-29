import Database from "@tauri-apps/plugin-sql";

let _db: Database | null = null;

async function getDB(): Promise<Database> {
  if (!_db) _db = await Database.load("sqlite:time-tracker.db");
  return _db;
}

export async function updateEntry(
  id: string,
  taskId: string,
  taskName: string,
  startTime: string,
  endTime: string,
  durationSeconds: number
): Promise<void> {
  const db = await getDB();
  await db.execute(
    "UPDATE time_entries SET taskId=?, taskNameSnapshot=?, startTime=?, endTime=?, durationSeconds=?, updatedAt=? WHERE id=?",
    [taskId, taskName, startTime, endTime, durationSeconds, new Date().toISOString(), id]
  );
}

export async function updateActiveEntry(
  id: string,
  taskId: string,
  taskName: string,
  startTime: string,
): Promise<void> {
  const db = await getDB();
  await db.execute(
    "UPDATE time_entries SET taskId=?, taskNameSnapshot=?, startTime=?, updatedAt=? WHERE id=?",
    [taskId, taskName, startTime, new Date().toISOString(), id]
  );
}

export async function deleteEntry(id: string): Promise<void> {
  const db = await getDB();
  await db.execute("DELETE FROM time_entries WHERE id=?", [id]);
}
