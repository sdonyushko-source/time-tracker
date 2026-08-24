import { TITLEBAR_HEIGHT } from "./TitleBarButtons";

// Every screen renders under an overlay title bar (see tauri.conf.json
// titleBarStyle: "Overlay") — the traffic lights float over the top
// TITLEBAR_HEIGHT px of the window instead of pushing content down
// themselves. Screens without their own titlebar buttons (everything except
// the main timer screen, which uses TitleBarButtons instead) render this in
// their place, just to reserve that space and keep the window draggable
// there.
export default function TitleBarSpacer() {
  return <div data-tauri-drag-region style={{ height: TITLEBAR_HEIGHT, flexShrink: 0, width: "100%" }} />;
}
