import { extractCalendarEvent } from './claude.js';
import { eventToCalendarUrl, logEvent } from './eventModel.js';

const MESSAGE_EXTRACT = 'EXTRACT_AND_OPEN';

function notify(message) {
  chrome.notifications?.create({
    type: 'basic',
    iconUrl: 'images/icon_128.png',
    title: 'gcal-scheduler',
    message: String(message).slice(0, 200),
  });
}

async function extractAndOpen(text) {
  const event = await extractCalendarEvent(text);
  logEvent(event);
  const url = eventToCalendarUrl(event);
  chrome.tabs.create({ url });
  return { success: true, url };
}

async function handleExtractMessage(msg, sendResponse) {
  const { text } = msg;
  if (!text || !String(text).trim()) {
    sendResponse({ success: false, error: 'Enter event text.' });
    return;
  }

  try {
    const result = await extractAndOpen(text);
    sendResponse(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    sendResponse({ success: false, error: message });
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== MESSAGE_EXTRACT) return false;
  handleExtractMessage(msg, sendResponse);
  return true;
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'add-to-calendar',
    title: 'Add to calendar: "%s"',
    contexts: ['selection'],
  });
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  const text = info.selectionText?.trim() || '';
  if (!text) return;

  try {
    await extractAndOpen(text);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    notify(message);
  }
});
