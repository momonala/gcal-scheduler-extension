/**
 * Calendar event data model: single source of truth for Google Calendar URL payload.
 * @typedef {{ title: string, dates: string, isAllDay?: boolean, location?: string, notes?: string }} CalendarEvent
 */

const DATES_ALL_DAY = /^\d{8}\/\d{8}$/;
const DATES_TIMED = /^\d{8}T\d{6}\/\d{8}T\d{6}$/;

function isValidDatesString(dates) {
  if (typeof dates !== 'string' || !dates) return false;
  return DATES_ALL_DAY.test(dates) || DATES_TIMED.test(dates);
}

/**
 * Validates a calendar event. Throws on invalid data.
 * @param {CalendarEvent} event
 * @returns {void}
 */
export function validateEvent(event) {
  if (!event || typeof event !== 'object') {
    throw new Error('Event must be a non-null object');
  }
  const title = event.title;
  if (typeof title !== 'string' || !title.trim()) {
    throw new Error('Event title is required and must be non-empty');
  }
  const dates = event.dates;
  if (!isValidDatesString(dates)) {
    throw new Error(
      'Event dates must be in Google format: YYYYMMDD/YYYYMMDD (all-day) or YYYYMMDDTHHmmss/YYYYMMDDTHHmmss (timed)'
    );
  }
}

/**
 * Builds the Google Calendar render URL from a validated event.
 * @param {CalendarEvent} event
 * @returns {string}
 */
export function eventToCalendarUrl(event) {
  validateEvent(event);
  const baseUrl = 'https://www.google.com/calendar/render';
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title.trim(),
    dates: event.dates,
  });

  if (event.location && event.location.trim()) {
    params.set('location', event.location.trim());
  }

  if (event.notes && event.notes.trim()) {
    params.set('details', event.notes.trim());
  }

  return `${baseUrl}?${params}`;
}

/**
 * Logs the event at the boundary. Never logs secrets.
 * @param {CalendarEvent} event
 */
export function logEvent(event) {
  console.log('[calendar event]', {
    title: event.title,
    dates: event.dates,
    isAllDay: event.isAllDay,
    location: event.location,
    notes: event.notes,
  });
}
