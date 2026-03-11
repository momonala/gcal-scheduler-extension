import { validateEvent } from './eventModel.js';

const OPENAI_BASE = 'https://api.openai.com/v1';

const EXTRACT_SCHEMA = {
  name: 'calendar_event',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Event title starting with a single descriptive emoji' },
      start: { type: 'string', description: 'Start date-time in ISO 8601' },
      end: { type: 'string', description: 'End date-time in ISO 8601' },
      is_all_day: { type: 'boolean', description: 'True if no specific time' },
      location: { type: 'string', description: 'Event location, if mentioned' },
      notes: { type: 'string', description: 'Additional notes or details, if mentioned' },
    },
    required: ['title', 'start', 'end', 'is_all_day', 'location', 'notes'],
    additionalProperties: false,
  },
};

const SYSTEM_MESSAGE = `Extract a single calendar event from the user's natural language input.
Return JSON with: title (string), start (ISO 8601), end (ISO 8601), is_all_day (boolean), location (string), and notes (string).
The title must start with a single descriptive emoji (e.g. 🍽️ Dinner with Sarah, 📅 Team standup).
The location must be only the venue address (e.g. "Karl-Marx-Straße 275-277, 12057 Berlin") and must NOT repeat the event or business name.
Put any extra descriptive text (class names, business names, etc.) into the title or notes, not into location.
For all-day events use date-only ISO (e.g. 2026-02-24). For timed events use full ISO (e.g. 2026-02-24T19:00:00).
If no location or notes are implied, still include those fields as empty strings.
If no end is implied, use 1 hour after start for timed events, or 1 day after start for all-day events.`;

function pad(n) {
  return String(n).padStart(2, '0');
}

/** Format a Date as YYYYMMDD or YYYYMMDDTHHmmss for Google Calendar. */
function formatDate(d, allDay) {
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  if (allDay) return `${y}${m}${day}`;
  const h = pad(d.getHours());
  const min = pad(d.getMinutes());
  const s = pad(d.getSeconds());
  return `${y}${m}${day}T${h}${min}${s}`;
}

/**
 * Converts ISO start/end and isAllDay to Google Calendar dates string.
 * @param {string} startIso
 * @param {string} endIso
 * @param {boolean} isAllDay
 * @returns {string}
 */
function isoToGoogleDates(startIso, endIso, isAllDay) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error('Invalid start or end date from extraction');
  }
  return [formatDate(start, isAllDay), formatDate(end, isAllDay)].join('/');
}

/**
 * Maps raw API response to our calendar event model.
 * @param {{ title: string, start: string, end: string, is_all_day: boolean, location?: string, notes?: string }} raw
 * @returns {import('./eventModel.js').CalendarEvent}
 */
function rawToEvent(raw) {
  const dates = isoToGoogleDates(raw.start, raw.end, raw.is_all_day);

  const title = String(raw.title || '').trim();

  let location = raw.location ? String(raw.location).trim() : '';
  if (location) {
    const titleHead = title.split(',')[0].trim().toLowerCase();
    const [firstSegment, ...rest] = location.split(',');
    if (rest.length && titleHead && firstSegment.trim().toLowerCase().includes(titleHead)) {
      location = rest.join(',').trim();
    }
  }

  const notes = raw.notes ? String(raw.notes).trim() : '';

  const event = {
    title,
    dates,
    isAllDay: Boolean(raw.is_all_day),
    location: location || undefined,
    notes: notes || undefined,
  };
  validateEvent(event);
  return event;
}

/**
 * Fetches list of models from OpenAI.
 * @param {string} apiKey
 * @returns {Promise<{ id: string }[]>}
 */
export async function listModels(apiKey) {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('OpenAI API key is required');
  }
  const res = await fetch(`${OPENAI_BASE}/models`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey.trim()}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI models request failed: ${res.status} ${body || res.statusText}`);
  }
  const data = await res.json();
  const list = data.data;
  if (!Array.isArray(list)) {
    throw new Error('OpenAI models response missing data array');
  }
  return list.map((m) => ({ id: m.id }));
}

/**
 * Extracts a calendar event from natural language using OpenAI Chat Completions.
 * @param {string} apiKey
 * @param {string} model
 * @param {string} text
 * @returns {Promise<import('./eventModel.js').CalendarEvent>}
 */
export async function extractCalendarEvent(apiKey, model, text) {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('OpenAI API key is required');
  }
  if (!model || !model.trim()) {
    throw new Error('Model is required');
  }
  if (!text || !String(text).trim()) {
    throw new Error('Input text is required');
  }

  const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey.trim()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model.trim(),
      messages: [
        { role: 'system', content: SYSTEM_MESSAGE },
        { role: 'user', content: String(text).trim() },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: EXTRACT_SCHEMA,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI completion failed: ${res.status} ${body || res.statusText}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (content == null || content === '') {
    throw new Error('OpenAI returned empty content');
  }

  let raw;
  try {
    raw = JSON.parse(content);
  } catch {
    throw new Error('OpenAI response was not valid JSON');
  }

  if (!raw || typeof raw.title !== 'string' || typeof raw.start !== 'string' || typeof raw.end !== 'string') {
    throw new Error('OpenAI response missing required fields: title, start, end');
  }

  return rawToEvent(raw);
}
