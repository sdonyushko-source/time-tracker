#!/bin/bash
# Reinstalls the locally-built Cuckoo.app into /Applications and relaunches it.
# Run after `npm run tauri build`.
#
# Merges the new build's contents over the existing app in place (`src/.`
# instead of `src`) instead of replacing the directory outright — `mv`/`cp -R`
# onto an existing non-empty directory would nest the new copy inside the old
# one rather than updating it, and there's no way to atomically replace a
# non-empty directory without deleting it first (which rm -rf is denied for
# in this project's Claude Code permissions).
set -euo pipefail

APP_SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/src-tauri/target/release/bundle/macos/Cuckoo.app"
APP_DST="/Applications/Cuckoo.app"

pkill -x time-tracker 2>/dev/null || true
sleep 1

mkdir -p "$APP_DST"
cp -R "$APP_SRC/." "$APP_DST/"
xattr -cr "$APP_DST"

open "$APP_DST"
sleep 2

ps aux | grep -i "time-tracker" | grep -v grep
log show --predicate 'process == "time-tracker"' --last 30s 2>/dev/null | grep -i -E "error|panic|exception" | head -20
echo "---done---"
