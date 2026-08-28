use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::menu::{IsMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{Emitter, Manager};
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_sql::Builder as SqlBuilder;

// A monotonically increasing generation counter. Each start_tray_timer call
// bumps it and captures its own value; the ticking thread compares against
// the live counter each second and exits once a newer generation (a fresh
// start, or a stop) has superseded it. This avoids needing any thread
// handles/cancellation channels for what is otherwise a fire-and-forget
// background loop.
struct TrayTimerState(Arc<AtomicU64>);

// Same fire-and-forget generation-counter pattern as TrayTimerState above,
// for the focus (Pomodoro) cycle: start_focus bumps the counter and spawns a
// thread that sleeps for the whole duration in one go (this is a one-shot
// deadline, not a per-second tick), then — only if no newer generation has
// superseded it (a stop, or a fresh start) — sends the system notification
// and tells the frontend to clear the ring. stop_focus just bumps the
// counter; the sleeping thread simply finds itself stale when it wakes and
// exits quietly, so a cancelled cycle never notifies.
struct FocusState(Arc<AtomicU64>);

#[tauri::command]
fn resize_window(app: tauri::AppHandle, width: f64, height: f64) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.set_size(tauri::Size::Logical(tauri::LogicalSize { width, height }));
    }
}

// The zoom (green) traffic-light button is greyed out and inert because the
// window is non-resizable — rather than leave a dead button visible, hide it
// via the native NSWindow API (Tauri/tauri.conf.json has no config option
// for this). Close and miniaturize stay untouched.
#[cfg(target_os = "macos")]
fn hide_zoom_button(window: &tauri::WebviewWindow) {
    use objc2::runtime::AnyObject;
    use objc2::msg_send;

    if let Ok(ns_window_ptr) = window.ns_window() {
        unsafe {
            let ns_window = ns_window_ptr as *mut AnyObject;
            // NSWindowButton.zoom == 2 (stable public AppKit constant).
            let zoom_button: *mut AnyObject = msg_send![ns_window, standardWindowButton: 2usize];
            if !zoom_button.is_null() {
                let _: () = msg_send![zoom_button, setHidden: true];
            }
        }
    }
}

// The "..." button's dropdown, shown as a real native context menu — not an
// HTML dropdown — specifically because the compact window (126px tall) is
// too short to host an HTML dropdown without clipping it; a native menu
// floats above the OS window entirely and is never clipped by it. Clicks
// are relayed back to the frontend as a "menu-action" event carrying the
// item id, rather than handled here, so the existing screen-navigation
// logic stays in one place (App.tsx). Expand/Collapse now has its own
// titlebar button instead of living in this menu.
#[tauri::command]
fn show_more_menu(app: tauri::AppHandle) {
    let Some(window) = app.get_webview_window("main") else { return };
    let build = || -> tauri::Result<()> {
        let menu = Menu::with_items(
            &app,
            &[
                &MenuItem::with_id(&app, "copy_report", "Copy monthly report", true, None::<&str>)?,
                &PredefinedMenuItem::separator(&app)?,
                &MenuItem::with_id(&app, "statistics", "Statistics", true, None::<&str>)?,
                &MenuItem::with_id(&app, "history", "History", true, None::<&str>)?,
                &PredefinedMenuItem::separator(&app)?,
                &MenuItem::with_id(&app, "task_manager", "Task management", true, None::<&str>)?,
                &MenuItem::with_id(&app, "schedule", "Schedule", true, None::<&str>)?,
                &MenuItem::with_id(&app, "settings", "Settings", true, None::<&str>)?,
            ],
        )?;
        window.popup_menu(&menu)
    };
    let _ = build();
}

#[derive(serde::Deserialize)]
struct TaskPickerTask {
    id: String,
    name: String,
}

#[derive(serde::Deserialize)]
struct TaskPickerGroup {
    label: String,
    tasks: Vec<TaskPickerTask>,
}

// Timer's task picker, for when there are 2+ visible clients (see
// computeVisibleClients in utils.ts) — an HTML <select> can't nest a
// client → task submenu, so this pops the same kind of native menu as
// show_more_menu, one Submenu per client. Task ids come back prefixed
// "task:" on the same "menu-action" event the "..." menu already uses
// (see on_menu_event below), so the frontend listener can tell a task
// selection apart from a screen-navigation id without a second event/
// command pair.
#[tauri::command]
fn show_task_picker_menu(app: tauri::AppHandle, groups: Vec<TaskPickerGroup>) {
    let Some(window) = app.get_webview_window("main") else { return };
    let build = || -> tauri::Result<()> {
        let mut submenus: Vec<Submenu<tauri::Wry>> = Vec::new();
        for group in &groups {
            let items: Vec<MenuItem<tauri::Wry>> = group
                .tasks
                .iter()
                .filter_map(|t| MenuItem::with_id(&app, format!("task:{}", t.id), &t.name, true, None::<&str>).ok())
                .collect();
            if items.is_empty() {
                continue;
            }
            let item_refs: Vec<&dyn IsMenuItem<tauri::Wry>> = items.iter().map(|i| i as &dyn IsMenuItem<tauri::Wry>).collect();
            submenus.push(Submenu::with_items(&app, &group.label, true, &item_refs)?);
        }
        let submenu_refs: Vec<&dyn IsMenuItem<tauri::Wry>> = submenus.iter().map(|s| s as &dyn IsMenuItem<tauri::Wry>).collect();
        let menu = Menu::with_items(&app, &submenu_refs)?;
        window.popup_menu(&menu)
    };
    let _ = build();
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

fn set_tray_title(app: &tauri::AppHandle, title: &str) {
    if let Some(tray) = app.tray_by_id("main") {
        // tray-icon's macOS backend treats `None` as "leave title unchanged",
        // not "clear it" — so an empty string must still be passed as
        // `Some("")` to actually clear stale text from the menu bar.
        let _ = tray.set_title(Some(title));
    }
}

// Ticks the tray title once a second from a plain OS thread. Driving this
// from JS via setInterval used to freeze the displayed time whenever the
// window lost visibility/focus, since WKWebView (like other browser
// engines) throttles or fully suspends renderer-side timers in that state.
// A native thread keeps running regardless of the webview's visibility.
#[tauri::command]
fn start_tray_timer(app: tauri::AppHandle, state: tauri::State<TrayTimerState>, start_time_ms: i64) {
    let generation = state.0.clone();
    let my_gen = generation.fetch_add(1, Ordering::SeqCst) + 1;
    std::thread::spawn(move || loop {
        if generation.load(Ordering::SeqCst) != my_gen {
            break;
        }
        let now_ms = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as i64;
        let elapsed = (now_ms - start_time_ms).max(0) / 1000;
        let title = format!("{:02}:{:02}:{:02}", elapsed / 3600, (elapsed % 3600) / 60, elapsed % 60);
        set_tray_title(&app, &title);
        std::thread::sleep(Duration::from_millis(1000));
    });
}

#[tauri::command]
fn stop_tray_timer(app: tauri::AppHandle, state: tauri::State<TrayTimerState>) {
    // Bumping the generation here too makes stop reliably outrace a
    // still-sleeping tick from the previous start, so the title can't get
    // rewritten with a stale time right after we clear it.
    state.0.fetch_add(1, Ordering::SeqCst);
    set_tray_title(&app, "");
}

// Played alongside the system notification when a focus cycle completes.
// afplay is macOS-only (fine — the rest of this app already assumes macOS,
// see hide_zoom_button above), and is spawned rather than waited on so it
// can't hold up the thread it's called from a moment longer than needed.
fn play_completion_sound(app: &tauri::AppHandle) {
    let Ok(resource_path) = app
        .path()
        .resolve("resources/focus-complete.mp3", tauri::path::BaseDirectory::Resource)
    else {
        return;
    };
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("afplay").arg(resource_path).spawn();
    }
}

#[tauri::command]
fn start_focus(app: tauri::AppHandle, state: tauri::State<FocusState>, duration_secs: u64, task_name: Option<String>) {
    let generation = state.0.clone();
    let my_gen = generation.fetch_add(1, Ordering::SeqCst) + 1;
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_secs(duration_secs));
        if generation.load(Ordering::SeqCst) != my_gen {
            return;
        }

        let mut builder = app.notification().builder().title("Time for a break");
        if let Some(name) = &task_name {
            builder = builder.body(format!("{} minutes on {}", duration_secs / 60, name));
        }
        let _ = builder.show();
        play_completion_sound(&app);

        let _ = app.emit("focus-complete", ());
    });
}

#[tauri::command]
fn stop_focus(state: tauri::State<FocusState>) {
    state.0.fetch_add(1, Ordering::SeqCst);
}

// Same generation-counter pattern again, for the auto-stop deadline
// (plannedEndTime / max session length — see computeAutoStopDeadline in
// utils.ts). Unlike start_focus, this doesn't send the notification or
// touch the database itself — the frontend owns both (it needs the task's
// name and the entry id, neither of which this side has), so this just
// wakes it up via an event once the deadline is reached uninterrupted.
struct AutoStopState(Arc<AtomicU64>);

#[tauri::command]
fn start_auto_stop(app: tauri::AppHandle, state: tauri::State<AutoStopState>, deadline_ms: i64) {
    let generation = state.0.clone();
    let my_gen = generation.fetch_add(1, Ordering::SeqCst) + 1;
    std::thread::spawn(move || {
        let now_ms = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as i64;
        let wait_ms = (deadline_ms - now_ms).max(0) as u64;
        std::thread::sleep(Duration::from_millis(wait_ms));
        if generation.load(Ordering::SeqCst) != my_gen {
            return;
        }
        let _ = app.emit("auto-stop-deadline", ());
    });
}

#[tauri::command]
fn stop_auto_stop(state: tauri::State<AutoStopState>) {
    state.0.fetch_add(1, Ordering::SeqCst);
}

// Schema is created (and kept up to date) by initDB() in src/db.ts via
// `CREATE TABLE IF NOT EXISTS`. We intentionally don't register sqlx
// migrations here: sqlx checksums each migration's SQL text and refuses to
// load the database if that text ever changes (even a whitespace edit),
// which bricked startup on this shared, long-lived db file.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(SqlBuilder::default().build())
        .manage(TrayTimerState(Arc::new(AtomicU64::new(0))))
        .manage(FocusState(Arc::new(AtomicU64::new(0))))
        .manage(AutoStopState(Arc::new(AtomicU64::new(0))))
        .setup(|_app| {
            #[cfg(target_os = "macos")]
            if let Some(window) = _app.get_webview_window("main") {
                hide_zoom_button(&window);
            }
            _app.on_menu_event(|app_handle, event| {
                let _ = app_handle.emit("menu-action", event.id().0.clone());
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            resize_window,
            show_more_menu,
            show_task_picker_menu,
            start_tray_timer,
            stop_tray_timer,
            start_focus,
            stop_focus,
            start_auto_stop,
            stop_auto_stop
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
