import { extractCalendarEvent } from './openai.js';
import { eventToCalendarUrl, logEvent } from './eventModel.js';
import { DEFAULT_MODEL, STORAGE_DEFAULTS } from './constants.js';

const MESSAGE_EXTRACT = 'EXTRACT_AND_OPEN';

function notify(message) {
  chrome.notifications?.create({
    type: 'basic',
    iconUrl: 'images/icon_128.png',
    title: 'gcal-scheduler',
    message: String(message).slice(0, 200),
  });
}

async function extractAndOpen(text, apiKey, model) {
  const event = await extractCalendarEvent(apiKey, model, text);
  logEvent(event);
  const url = eventToCalendarUrl(event);
  chrome.tabs.create({ url });
  return { success: true, url };
}

async function handleExtractMessage(msg, sendResponse) {
  const { text, model: msgModel } = msg;
  const storage = await chrome.storage.sync.get(STORAGE_DEFAULTS);
  const apiKey = (msg.apiKey ?? storage.apiKey) || '';
  const model = msgModel || storage.model || DEFAULT_MODEL;

  if (!apiKey.trim()) {
    sendResponse({ success: false, error: 'Set your OpenAI API key in the extension popup.' });
    return;
  }
  if (!model.trim()) {
    sendResponse({ success: false, error: 'Select a model in the extension popup.' });
    return;
  }
  if (!text || !String(text).trim()) {
    sendResponse({ success: false, error: 'Enter event text.' });
    return;
  }

  try {
    const result = await extractAndOpen(text, apiKey, model);
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

  const storage = await chrome.storage.sync.get(STORAGE_DEFAULTS);
  const model = storage.model?.trim() || DEFAULT_MODEL;

  if (!storage.apiKey?.trim()) {
    notify('Set your OpenAI API key in the extension popup.');
    return;
  }

  try {
    await extractAndOpen(text, storage.apiKey, model);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    notify(message);
  }
});
