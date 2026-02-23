import { listModels } from './openai.js';
import { DEFAULT_MODEL, STORAGE_DEFAULTS } from './constants.js';

const MESSAGE_EXTRACT = 'EXTRACT_AND_OPEN';

const el = {};
function bindElements() {
  el.apiKey = document.getElementById('api-key');
  el.model = document.getElementById('model');
  el.modelStatus = document.getElementById('model-status');
  el.input = document.getElementById('input');
  el.add = document.getElementById('add');
  el.error = document.getElementById('error');
}

function showError(msg) {
  el.error.textContent = msg ?? '';
}

function setAddLoading(loading) {
  el.add.disabled = loading;
  el.add.textContent = loading ? 'Adding…' : 'Add';
}

async function loadModels(apiKey) {
  if (!apiKey?.trim()) {
    el.modelStatus.textContent = '';
    return;
  }
  el.modelStatus.textContent = 'Loading…';
  try {
    const list = await listModels(apiKey);
    const chatModels = list.filter((m) => /^gpt-|^o\d/.test(m.id));
    el.model.innerHTML = '<option value="">— Select model —</option>';
    for (const m of chatModels) {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.id;
      el.model.appendChild(opt);
    }
    el.modelStatus.textContent = '';
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    el.modelStatus.textContent = 'Failed to load models';
    el.modelStatus.title = message;
  }
}

async function restoreAndLoad() {
  const storage = await chrome.storage.sync.get(STORAGE_DEFAULTS);
  el.apiKey.value = storage.apiKey || '';
  await loadModels(storage.apiKey || '');
  if (storage.model && el.model.querySelector(`option[value="${storage.model}"]`)) {
    el.model.value = storage.model;
  } else if (el.model.querySelector(`option[value="${DEFAULT_MODEL}"]`)) {
    el.model.value = DEFAULT_MODEL;
    if (!storage.model) chrome.storage.sync.set({ model: DEFAULT_MODEL });
  }
}

function saveApiKey() {
  const key = el.apiKey.value.trim();
  chrome.storage.sync.set({ apiKey: key }, () => {
    if (key) loadModels(key);
  });
}

function saveModel() {
  chrome.storage.sync.set({ model: el.model.value || '' });
}

async function onAdd(e) {
  e.preventDefault();
  const text = el.input.value.trim();
  const storage = await chrome.storage.sync.get(STORAGE_DEFAULTS);
  const model = storage.model?.trim() || DEFAULT_MODEL;

  if (!storage.apiKey?.trim()) {
    showError('Enter your OpenAI API key above.');
    el.apiKey.focus();
    return;
  }
  if (!text) {
    showError('Enter event text.');
    el.input.focus();
    return;
  }

  showError('');
  setAddLoading(true);
  try {
    const response = await chrome.runtime.sendMessage({
      type: MESSAGE_EXTRACT,
      text,
      model,
    });
    if (response?.success) {
      el.input.value = '';
    } else {
      showError(response?.error || 'Something went wrong.');
    }
  } catch (err) {
    showError(err instanceof Error ? err.message : String(err));
  } finally {
    setAddLoading(false);
  }
}

function init() {
  bindElements();
  restoreAndLoad();
  el.apiKey.addEventListener('blur', saveApiKey);
  el.model.addEventListener('change', saveModel);
  document.getElementById('popup-form').addEventListener('submit', onAdd);
}

init();
