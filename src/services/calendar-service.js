const CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

/**
 * Handles the export of events to Google Calendar
 * @param {Array} events - Array of calendar events to export
 * @returns {Promise} - Resolves with the result of the export
 */
export async function handleCalendarExport(events) {
  console.log("Exporting events to Google Calendar:", events);
  try {
    const token = await getAuthToken();
    const settings = await getSettings();
    const calendarId = settings.defaultCalendarId || "primary";

    // Process events in batches to avoid rate limits
    const batchSize = 10;
    const results = [];

    for (let i = 0; i < events.length; i += batchSize) {
      const batch = events.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((event) => insertCalendarEvent(event, calendarId, token))
      );
      results.push(...batchResults);
    }
    chrome.tabs.create({ url: "https://calendar.google.com" });

    return {
      success: true,
      exported: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      errors: results.filter((r) => !r.success).map((r) => r.error),
    };
  } catch (error) {
    console.error("Calendar export failed:", error);
    throw new Error("Failed to export events: " + error.message);
  }
}

/**
 * Gets the authentication token for Google Calendar API
 * @returns {Promise<string>} - Resolves with the auth token
 */
async function getAuthToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(token);
      }
    });
  });
}

/**
 * Gets the user settings from storage
 * @returns {Promise<Object>} - Resolves with the settings object
 */
async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      {
        defaultCalendarId: "primary",
        colorCoding: true,
        notifications: true,
      },
      resolve
    );
  });
}

/**
 * Inserts a single event into Google Calendar
 * @param {Object} event - The event to insert
 * @param {string} calendarId - The ID of the calendar
 * @param {string} token - The auth token
 * @returns {Promise<Object>} - Resolves with the result of the insertion
 */
async function insertCalendarEvent(event, calendarId, token) {
  console.log("Inserting event:", JSON.stringify(event));
  try {
    const response = await fetch(
      `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error.message);
    }

    const result = await response.json();
    return { success: true, eventId: result.id };
  } catch (error) {
    console.error("Failed to insert event:", error);
    return {
      success: false,
      error: error.message,
      event: event.summary,
    };
  }
}
