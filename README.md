# gcal-scheduler

Chrome extension: create Google Calendar events from natural language. Uses Claude Sonnet 5.5, through your logged-in Claude Code CLI, to parse text into title + date/time + location + notes, then opens the Google Calendar add-event URL.

The extension can't call Claude directly, so it talks to a small local native messaging host (`native-host/gcal_scheduler_host.py`) that runs `claude -p` with tools disabled. Usage counts against your Claude subscription; no API key needed. macOS only. Each event takes about 5s.

**Setup:**

1. Install [Claude Code](https://claude.com/claude-code) and log in (`claude`, then `/login`).
2. `chrome://extensions` → Developer mode → Load unpacked → select the `chrome-extension` folder. Copy the extension ID.
3. `native-host/install.sh <extension-id>`, then reload the extension.

The host manifest stores the absolute path to this repo, so re-run step 3 if you move the folder. The extension ID depends on the folder path too.

**Use:** Popup — type e.g. `dinner friday 7pm at Flour+Water, note: celebrate promotion`, click Add. Or select text anywhere (including location and notes) → right-click → Add to calendar.
