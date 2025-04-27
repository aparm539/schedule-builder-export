# Message Passing Analysis and Improvements

## Message Passing Overview

**Content Script (`src/content/content-script.js`):**

- Listens for messages:
  - `GET_SCHEDULE` → parses page and responds with events.
  - `GET_COURSES` → extracts course list and responds with data.
- On load, sends `CONTENT_SCRIPT_READY` via `chrome.runtime.sendMessage` (currently unhandled).

**Popup (`src/popup/popup.js` & `src/settings/settings.js`):**

- Uses `chrome.tabs.sendMessage` to request `GET_SCHEDULE` and `GET_COURSES` from content script.
- Imports and directly calls `handleCalendarExport` from `calendar-service.js` instead of messaging background.
- Calls `chrome.identity.getAuthToken` in settings manager, bypassing background.

**Background Service Worker (`src/background/service-worker.js`):**

- Listens for:
  - `EXPORT_CALENDAR` → invokes `handleCalendarExport`.
  - `GET_AUTH_TOKEN` → wraps `chrome.identity.getAuthToken`.
- Neither message type is sent currently (handlers are unused).

## Suggested Improvements

1. **Centralize Operations in Background**

   - Move all API interactions (export, auth) to the service worker.
   - In the popup, send an `EXPORT_CALENDAR` message (with events) instead of importing `handleCalendarExport`.
   - In the popup/settings, request auth via `GET_AUTH_TOKEN`, not direct `chrome.identity` calls.

2. **Unify Messaging Interfaces**

   - Create a shared `messageTypes.js` enum for all types (`GET_SCHEDULE`, `GET_COURSES`, `EXPORT_CALENDAR`, `GET_AUTH_TOKEN`, etc.).
   - Implement a promise-based `sendMessage` wrapper to standardize requests and timeouts.
   - Ensure each `onMessage` handler returns `true` when sending response asynchronously.

3. **Clean Up Unused Code**

   - Remove unused handlers in background or integrate them properly.
   - Drop `CONTENT_SCRIPT_READY` messaging if unused, or handle it to track initialization state.

4. **Enhance Error Handling**

   - Standardize response format: `{ success: boolean, data?, errorCode?, errorMessage? }`.
   - Implement timeouts in messaging wrapper to reject stale calls.

5. **Security and Validation**

   - In each `onMessage`, validate `sender` (e.g., `sender.id` or URL) before processing.
   - If exposing external APIs, use `onMessageExternal` with strict origin checks.

6. **Documentation & Testing**
   - Document the updated message flow in code comments and `README.md`.
   - Write integration tests (e.g., via Puppeteer) to simulate popup ↔ content ↔ background messaging.

---

These changes will standardize communication, remove dead code, and improve maintainability and security of the extension.
