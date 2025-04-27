import { SettingsManager } from "../settings/settings.js";
import { getCurrentTab } from "../utils/get-current-tab.js";

let currentTab = null;
let settingsManager = null;

document.addEventListener("DOMContentLoaded", async () => {
  settingsManager = new SettingsManager();
  await settingsManager.initialize();
  await settingsManager.setupUI();
  settingsManager.bindEvents();
  await settingsManager.setupCourseColors();
  currentTab = await getCurrentTab();

  try {
    const confirmExport = document.getElementById("confirm-export");
    if (confirmExport)
      confirmExport.addEventListener("click", handleConfirmExport);

    updateExportButtonState();
  } catch (error) {
    console.error("Detailed initialization error:", error);
    showStatus(`Initialization failed: ${error.message}`, "error");
  }
});

async function handleConfirmExport() {
  try {
    showStatus("Exporting your schedule...", "loading");
    const response = await chrome.runtime.sendMessage({
      type: "SCHEDULE",
    });

    if (!response.success) {
      throw new Error(response.error || "Failed to get schedule");
    }
    const calendarResponse = await chrome.runtime.sendMessage({
      type: "EXPORT_CALENDAR",
      events: response.events,
    });

    if (!calendarResponse.success) {
      throw new Error(calendarResponse.error || "Failed to export schedule");
    }
    showStatus("Schedule exported successfully!", "success");
  } catch (error) {
    console.error("Export failed:", error);
    showStatus(error.message || "Failed to export schedule", "error");
  }
}

function showStatus(message, type = "info") {
  const statusEl = document.getElementById("status-message");
  if (!statusEl) {
    console.error("Status message element not found");
    return;
  }
  statusEl.textContent = message;
  statusEl.className = `status-message ${type}`;
}

function updateExportButtonState() {
  const button = document.getElementById("confirm-export");
  if (!button) {
    console.error("Export button not found");
    return;
  }

  if (!currentTab?.url?.includes("sb.mymru.ca/criteria.jsp")) {
    button.disabled = true;
    showStatus(
      "Please open Schedule Builder to export your schedule",
      "warning"
    );
  } else {
    button.disabled = false;
    showStatus("");
  }
}
