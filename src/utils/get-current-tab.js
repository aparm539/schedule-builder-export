export async function getCurrentTab() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) {
      throw new Error("No active tab found");
    }
    return tabs[0];
  } catch (error) {
    console.error("Error getting current tab:", error);
    throw error;
  }
}
