//Event page to export the calendar events to Google Calendar
chrome.runtime.onMessage.addListener(
  //When we receive a message from the content script...
  function (request, sender, sendResponse) {
    console.log("Inside the event listener");
    //Authorize the user
    chrome.identity.getAuthToken({ interactive: true }, function (token) {
      const url =
        "https://www.googleapis.com/calendar/v3/calendars/primary/events";

      request.forEach(async (event) => {
        try {
          const response = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer " + token,
            },
            body: JSON.stringify(event),
          });

          if (!response.ok) {
            const errorData = await response.json();
            console.error("Error posting event:", errorData);
          } else {
            const responseData = await response.json();
            console.log("Event posted successfully:", responseData);
          }
        } catch (error) {
          console.error("Network error:", error);
        }
      });
      chrome.tabs.create({ url: "https://calendar.google.com" }); //link to calendar
    });
  }
);
