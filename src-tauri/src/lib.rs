//! Dangle: a transparent, always-on-top strip across the top of the screen where the
//! charms hang. The strip ignores the mouse everywhere except over a charm, so the
//! apps underneath keep working. A normal window, the shelf, is where you pick charms.

use serde::Serialize;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_global_shortcut::ShortcutState;

/// How far down the screen the charms can swing, in logical pixels.
pub const STRIP_HEIGHT: f64 = 360.0;
const TOGGLE_SHORTCUT: &str = "Alt+Shift+D";

#[derive(Serialize, Debug, PartialEq)]
pub struct Point {
    pub x: f64,
    pub y: f64,
}

/// Converts a global cursor position into the strip's own logical coordinates.
pub fn to_local(cursor: (f64, f64), origin: (f64, f64), scale: f64) -> Point {
    let scale = if scale > 0.0 { scale } else { 1.0 };
    Point { x: (cursor.0 - origin.0) / scale, y: (cursor.1 - origin.1) / scale }
}

/// Where the mouse is relative to the strip. The strip polls this because it can't
/// see the mouse while it lets clicks pass through to the apps below.
#[tauri::command]
fn cursor(app: AppHandle) -> Option<Point> {
    let win = app.get_webview_window("strip")?;
    let p = app.cursor_position().ok()?;
    let o = win.inner_position().ok()?;
    let s = win.scale_factor().ok()?;
    Some(to_local((p.x, p.y), (o.x as f64, o.y as f64), s))
}

/// Stretches the strip across the top of the main screen, just under the menu bar
/// or the top edge.
#[tauri::command]
fn fit(app: AppHandle) {
    let Some(win) = app.get_webview_window("strip") else { return };
    let monitor = win.primary_monitor().ok().flatten().or_else(|| win.current_monitor().ok().flatten());
    let Some(monitor) = monitor else { return };
    let scale = monitor.scale_factor();
    let area = monitor.work_area();
    let _ = win.set_size(LogicalSize::new(area.size.width as f64 / scale, STRIP_HEIGHT));
    let _ = win.set_position(LogicalPosition::new(area.position.x as f64 / scale, area.position.y as f64 / scale));
}

#[tauri::command]
fn open_shelf(app: AppHandle) {
    if let Some(win) = app.get_webview_window("shelf") {
        let _ = win.unminimize();
        let _ = win.show();
        let _ = win.set_focus();
        return;
    }
    let _ = WebviewWindowBuilder::new(&app, "shelf", WebviewUrl::App("shelf.html".into()))
        .title("Dangle")
        .inner_size(820.0, 640.0)
        .min_inner_size(560.0, 480.0)
        .center()
        .build();
}

fn toggle_strip(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("strip") {
        if win.is_visible().unwrap_or(true) {
            let _ = win.hide();
        } else {
            let _ = win.show();
        }
        let _ = app.emit("dangle://visibility", win.is_visible().unwrap_or(true));
    }
}

#[tauri::command]
fn set_visible(app: AppHandle, visible: bool) {
    if let Some(win) = app.get_webview_window("strip") {
        let _ = if visible { win.show() } else { win.hide() };
        let _ = app.emit("dangle://visibility", visible);
    }
}

#[tauri::command]
fn is_visible(app: AppHandle) -> bool {
    app.get_webview_window("strip").and_then(|w| w.is_visible().ok()).unwrap_or(true)
}

#[tauri::command]
fn quit(app: AppHandle) {
    app.exit(0);
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| open_shelf(app.clone())))
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, None))
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_shortcuts([TOGGLE_SHORTCUT])
                .expect("valid shortcut")
                .with_handler(|app, _, event| {
                    if event.state == ShortcutState::Pressed {
                        toggle_strip(app);
                    }
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![cursor, fit, open_shelf, set_visible, is_visible, quit])
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            let handle = app.handle().clone();
            fit(handle.clone());
            if let Some(win) = app.get_webview_window("strip") {
                // Show first: on Linux the window has no native surface to shape until it's shown.
                let _ = win.show();
                let _ = win.set_ignore_cursor_events(true);
            }

            let shelf = MenuItem::with_id(app, "shelf", "Choose charms…", true, None::<&str>)?;
            let toggle = MenuItem::with_id(app, "toggle", "Hide or show charms (Alt Shift D)", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit Dangle", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&shelf, &toggle, &quit])?;
            TrayIconBuilder::new()
                .icon(app.default_window_icon().cloned().expect("app icon"))
                .tooltip("Dangle")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "shelf" => open_shelf(app.clone()),
                    "toggle" => toggle_strip(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                        open_shelf(tray.app_handle().clone());
                    }
                })
                .build(app)?;

            // Open the shelf on the very first launch so people see what to do.
            let first = handle.path().app_config_dir().map(|d| d.join("launched")).ok();
            if let Some(marker) = first {
                if !marker.exists() {
                    let _ = std::fs::create_dir_all(marker.parent().unwrap());
                    let _ = std::fs::write(&marker, b"1");
                    open_shelf(handle);
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Dangle");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn converts_cursor_to_strip_coordinates() {
        assert_eq!(to_local((300.0, 140.0), (100.0, 40.0), 2.0), Point { x: 100.0, y: 50.0 });
        assert_eq!(to_local((10.0, 10.0), (0.0, 0.0), 0.0), Point { x: 10.0, y: 10.0 });
    }
}
