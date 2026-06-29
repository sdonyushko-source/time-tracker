use tauri_plugin_sql::{Builder as SqlBuilder, Migration, MigrationKind};

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![Migration {
        version: 1,
        description: "create_initial_tables",
        sql: "
            CREATE TABLE IF NOT EXISTS settings (
                id      INTEGER PRIMARY KEY DEFAULT 1,
                hourlyRate          REAL,
                currency            TEXT,
                dailyGoalSeconds    INTEGER
            );

            CREATE TABLE IF NOT EXISTS tasks (
                id          TEXT PRIMARY KEY,
                name        TEXT NOT NULL,
                archived    INTEGER DEFAULT 0,
                createdAt   TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS time_entries (
                id                  TEXT PRIMARY KEY,
                taskId              TEXT NOT NULL,
                taskNameSnapshot    TEXT,
                date                TEXT,
                startTime           TEXT,
                endTime             TEXT,
                durationSeconds     INTEGER,
                hourlyRateSnapshot  REAL,
                currencySnapshot    TEXT,
                createdAt           TEXT,
                updatedAt           TEXT
            );
        ",
        kind: MigrationKind::Up,
    }];

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(
            SqlBuilder::default()
                .add_migrations("sqlite:time-tracker.db", migrations)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
