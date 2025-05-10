/**
 * Sends a message to a specific tab using chrome.tabs.sendMessage with a timeout and promise interface.
 * @param {number} tabId - The ID of the tab to send the message to.
 * @param {object} message - The message object to send (should include a type from MessageTypes).
 * @param {number} [timeout=5000] - Timeout in milliseconds (default 5s).
 * @returns {Promise<any>} Resolves with the response, or rejects on error/timeout.
 */
export function sendTabMessage(tabId, message, timeout = 5000) {
  return new Promise((resolve, reject) => {
    let didRespond = false;
    const timer = setTimeout(() => {
      if (!didRespond) {
        didRespond = true;
        reject(new Error("Tab message timeout after " + timeout + "ms"));
      }
    }, timeout);

    try {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (didRespond) return;
        clearTimeout(timer);
        didRespond = true;
        const err = chrome.runtime.lastError;
        if (err) {
          reject(new Error(err.message));
        } else {
          resolve(response);
        }
      });
    } catch (err) {
      if (!didRespond) {
        clearTimeout(timer);
        didRespond = true;
        reject(err);
      }
    }
  });
}
