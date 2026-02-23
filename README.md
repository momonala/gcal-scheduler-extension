# gcal-scheduler

Chrome extension: create Google Calendar events from natural language. Uses OpenAI to parse text into title + date/time, then opens the Google Calendar add-event URL.

**Setup:** `chrome://extensions` → Developer mode → Load unpacked → select the `chrome-extension` folder. Click the extension icon, enter your OpenAI API key (saved on blur). Default model is gpt-5.2.

**Use:** Popup — type e.g. "dinner friday 7pm", click Add. Or select text anywhere → right-click → Add to calendar.
