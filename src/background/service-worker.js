import { handleCalendarExport } from "../services/calendar-service.js";
import { getCurrentTab } from "../utils/get-current-tab.js";
import { MessageTypes } from "../utils/messageTypes.js";
import { sendTabMessage } from "../utils/sendTabMessage.js";

// Allowed sender extension id (self)
const ALLOWED_SENDER_ID = chrome.runtime.id;
const ALLOWED_SENDER_URL_PATTERNS = [
  new RegExp(`^chrome-extension://${ALLOWED_SENDER_ID}/.*`), // any page from this extension
  /^https:\/\/sb\.mymru\.ca\/.*/, // content script on schedule builder
];

function isAllowedSenderUrl(url) {
  if (!url) return false;
  return ALLOWED_SENDER_URL_PATTERNS.some((pattern) => pattern.test(url));
}

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.storage.sync.set({
      defaultCalendarId: "primary",
      colorCoding: true,
      notifications: true,
    });
  }
});

const handleCourses = async (sendResponse) => {
  const tab = await getCurrentTab();
  try {
    const response = await sendTabMessage(
      tab.id,
      {
        type: MessageTypes.GET_COURSES,
      },
      5000
    );
    if (response?.success) {
      sendResponse({ success: true, data: response.courses });
    } else {
      sendResponse({
        success: false,
        errorCode: "NO_COURSES",
        errorMessage: response?.error || "Failed to get courses",
      });
    }
  } catch (error) {
    sendResponse({
      success: false,
      errorCode: "SEND_TAB_MESSAGE_ERROR",
      errorMessage: error.message,
    });
  }
};

const handleSchedule = async (sendResponse) => {
  const tab = await getCurrentTab();
  try {
    const response = await sendTabMessage(
      tab.id,
      {
        type: MessageTypes.GET_SCHEDULE,
      },
      5000
    );
    if (response?.success) {
      sendResponse({ success: true, data: response.events });
    } else {
      sendResponse({
        success: false,
        errorCode: "NO_SCHEDULE",
        errorMessage: response?.error || "Failed to get schedule",
      });
    }
  } catch (error) {
    sendResponse({
      success: false,
      errorCode: "SEND_TAB_MESSAGE_ERROR",
      errorMessage: error.message,
    });
  }
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    // Validate sender extension id
    if (!sender.id || sender.id !== ALLOWED_SENDER_ID) {
      sendResponse({
        success: false,
        errorCode: "INVALID_SENDER",
        errorMessage: "Message sender is not authorized.",
      });
      return false;
    }
    // Validate sender URL
    if (!isAllowedSenderUrl(sender.url)) {
      sendResponse({
        success: false,
        errorCode: "INVALID_SENDER_URL",
        errorMessage: `Sender URL not allowed: ${sender.url}`,
      });
      return false;
    }

    if (message.type === MessageTypes.SCHEDULE) {
      handleSchedule(sendResponse);
      return true;
    }
    if (message.type === MessageTypes.COURSES) {
      handleCourses(sendResponse);
      return true;
    }
    if (message.type === MessageTypes.EXPORT_CALENDAR) {
      try {
        const result = handleCalendarExport(message.events);
        sendResponse({ success: true, data: result });
        return true;
      } catch (error) {
        sendResponse({
          success: false,
          errorCode: "CALENDAR_EXPORT_ERROR",
          errorMessage: error.message,
        });
      }
      return true;
    }
    if (message.type === MessageTypes.GET_AUTH_TOKEN) {
      chrome.identity.getAuthToken({ interactive: true }, (token) => {
        if (chrome.runtime.lastError) {
          sendResponse({
            success: false,
            errorCode: "AUTH_ERROR",
            errorMessage: chrome.runtime.lastError.message,
          });
        } else {
          sendResponse({ success: true, data: { token } });
        }
      });
      return true;
    }
  } catch (error) {
    console.error("Error handling message:", error);
    sendResponse({
      success: false,
      errorCode: "UNEXPECTED_ERROR",
      errorMessage: error.message,
    });
  }
});
