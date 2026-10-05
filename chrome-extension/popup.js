const MESSAGE_EXTRACT = 'EXTRACT_AND_OPEN';

const el = {};
function bindElements() {
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

async function onAdd(e) {
  e.preventDefault();
  const text = el.input.value.trim();
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
  document.getElementById('popup-form').addEventListener('submit', onAdd);
}

init();
