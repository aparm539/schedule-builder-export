/**
 * Sends a message using chrome.runtime.sendMessage with a timeout and promise interface.
 * @param {object} message - The message object to send (should include a type from MessageTypes).
 * @param {number} [timeout=5000] - Timeout in milliseconds (default 5s).
 * @returns {Promise<any>} Resolves with the response, or rejects on error/timeout.
 */
export function sendMessage(message, timeout = 5000) {
  return new Promise((resolve, reject) => {
    let didRespond = false;
    const timer = setTimeout(() => {
      if (!didRespond) {
        didRespond = true;
        reject(new Error("Message timeout after " + timeout + "ms"));
      }
    }, timeout);

    try {
      chrome.runtime.sendMessage(message, (response) => {
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
