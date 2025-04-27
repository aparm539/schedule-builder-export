import { handleCalendarExport } from "../services/calendar-service.js";
import { getCurrentTab } from "../utils/get-current-tab.js";

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
  const response = await chrome.tabs.sendMessage(tab.id, {
    type: "GET_COURSES",
  });
  sendResponse(response);
};

const handleSchedule = async (sendResponse) => {
  const tab = await getCurrentTab();
  const response = await chrome.tabs.sendMessage(tab.id, {
    type: "GET_SCHEDULE",
  });
  sendResponse(response);
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    if (message.type === "SCHEDULE") {
      handleSchedule(sendResponse);
      return true;
    }
    if (message.type === "COURSES") {
      handleCourses(sendResponse);
      return true;
    }
    if (message.type === "EXPORT_CALENDAR") {
      const result = handleCalendarExport(message.events);
      sendResponse({ success: true, result });
      return true;
    }

    if (message.type === "GET_AUTH_TOKEN") {
      chrome.identity.getAuthToken({ interactive: true }, (token) => {
        if (chrome.runtime.lastError) {
          sendResponse({
            success: false,
            error: chrome.runtime.lastError.message,
          });
        } else {
          sendResponse({ success: true, token });
        }
      });
      return true;
    }
  } catch (error) {
    console.error("Error handling message:", error);
    sendResponse({ success: false, error: error.message });
  }
});
