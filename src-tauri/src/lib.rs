use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::{Emitter, Manager};
use tauri_plugin_sql::Builder as SqlBuilder;

// A monotonically increasing generation counter. Each start_tray_timer call
// bumps it and captures its own value; the ticking thread compares against
// the live counter each second and exits once a newer generation (a fresh
// start, or a stop) has superseded it. This avoids needing any thread
// handles/cancellation channels for what is otherwise a fire-and-forget
// background loop.
struct TrayTimerState(Arc<AtomicU64>);

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
                &MenuItem::with_id(&app, "schedule", "Schedule", true, None::<&str>)?,
                &PredefinedMenuItem::separator(&app)?,
                &MenuItem::with_id(&app, "task_manager", "Task manager", true, None::<&str>)?,
                &MenuItem::with_id(&app, "settings", "Settings", true, None::<&str>)?,
            ],
        )?;
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
            start_tray_timer,
            stop_tray_timer
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
