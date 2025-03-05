class EventTime {
  dateTime;
  timeZone;
  constructor(dateTime, timeZone) {
    this.dateTime = dateTime;
    this.timezone = timeZone;
  }
}

class CourseEvent {
  summary;
  description;
  start;
  end;
  recurrence;
  constructor(summary, description, start, end, recurrence) {
    this.summary = summary;
    this.description = description;
    this.start = start;
    this.end = end;
    this.recurrence = recurrence;
  }
}

class Course {
  title;
  courseCode;
  constructor(title, courseCode) {
    this.title = title;
    this.courseCode = courseCode;
  }
}
const months = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
};

const days = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

// Content script to insert "Export" button into Schedule Builder page
// Scrapes data from Schedule builder and forms a request in compliance with the Google Calendar API, and sends this data to export.js

var div = document.createElement("div");
var open = false,
  exported = false; // Track if the popup window is open, and if exporting has been completed
div.className = "dropdown inline";
var button = document.createElement("button");
button.className =
  "mdl-button mdl-js-button mdl-button--raised white-background disable-no-results disable-no-crf";
button.addEventListener("click", parseAndExport);
var text = document.createTextNode("Export");
button.appendChild(text);
div.appendChild(button);

var parent = document.getElementsByClassName("bottom-buttons-2 noprint")[0]; // Parent: the element we want to insert the button as a child of

// Insert the button
parent.appendChild(div);

div.className = "dropdown inline open";
var popupWindow = document.createElement("div");

popupWindow.className = "dropdown-menu defaultcase pull-right";
popupWindow.style.textAlign = "center";
// Parses text from Schedule Builder and exports to Google Calendar
function parseAndExport() {
  var eventArray = [];
  if (!open) {
    // If the popup is not already open...
    open = true;
    if (!exported) {
      // And we haven't already exported
      // Add the popup to the page
      div.appendChild(popupWindow);
      var calendarEvent;
      var courseContainer = document.getElementById("legend_box");
      var courses =
        courseContainer.getElementsByClassName("course_cell_legend"); // Element containing all courses in the schedule

      for (var i = 0; i < courses.length; i++) {
        // For each course listing
        console.log(courses[i].innerText);
        const courseInformation = courses[i].innerText
          .split("\n")
          .filter((str) => /\w+/.test(str));
        const parsedDates = courseInformation[1];
        const [semester, year] = parsedDates.split(":")[0].split(" ");
        let [parsedStartDate, parsedEndDate] = parsedDates
          .split(":")[1]
          .split("-");
        parsedStartDate = parsedStartDate.trim().split(" ");
        parsedEndDate = parsedEndDate.trim().split(" ");
        const startMonth = months[parsedStartDate[0]];
        const startDay = parsedStartDate[1];
        const endMonth = months[parsedEndDate[0]];
        const endDay = parsedEndDate[1];
        const semesterStart = new Date(year, startMonth, startDay);

        const parsedDays =
          courseInformation[4]
            ?.split(":")[0]
            .split(",")
            .map((n) => n.trim()) || [];

        if (days[parsedDays[0]] < semesterStart.getDay()) {
          var firstDayofClass =
            semesterStart.getDate() - days[parsedDays[0]] + 7;
          var ClassStart = new Date(year, startMonth, firstDayofClass);
        } else {
          var firstDayofClass = days[parsedDays[0]] - 1;
          var ClassStart = new Date(year, startMonth, firstDayofClass);
        }
        var index = courseInformation[4].indexOf(":");
        var parsedTime = courseInformation[4].slice(index + 1);

        var courseCode = courseInformation[0];
        var courseName = courseInformation[3];
        var untilDate = new Date(year, endMonth, endDay);

        calendarEvent = createEvent(
          year,
          startMonth,
          ClassStart.getDate(),
          courseCode,
          courseName,
          parsedTime,
          parsedDays,
          "E203",
          untilDate
        );
        eventArray.push(calendarEvent);
      }
      // Add "Go" button
      var submit = document.createElement("button");
      submit.className = "btn btn-mini white-on-navyblue";
      submit.textContent = "Go!";
      submit.addEventListener("click", function () {
        exportToGoogle(eventArray);
      });
      popupWindow.appendChild(submit);
    } else {
      div.appendChild(popupWindow);
      document.innerHTML = "Calendar exported.";
    }
  } else {
    open = false;
    div.removeChild(popupWindow);
  }
}

function createEvent(
  year,
  month,
  day,
  courseName,
  parsedName,
  parsedTime,
  parsedDays,
  parsedLocation,
  untilDate
) {
  // Convert AM/PM time into 24-hr
  var splitTime = parsedTime.split("to"); // Split into start/end times
  var startAMPM = splitTime[0].trim(); // Start time in AM/PM format
  var startAMPMStr = startAMPM.match(/\s(.*)$/)[1];
  var endAMPM = splitTime[1].trim();
  var endAMPMStr = endAMPM.match(/\s(.*)$/)[1];
  var start = {
    hours: Number(startAMPM.match(/^(\d+)/)[1]),
    minutes: Number(startAMPM.match(/:(\d+)/)[1]),
  };
  if (startAMPMStr == "PM" && start.hours < 12) {
    start.hours += 12;
  }
  if (startAMPMStr == "AM" && start.hours == 12) {
    start.hours = 0;
  }
  var end = {
    hours: Number(endAMPM.match(/^(\d+)/)[1]),
    minutes: Number(endAMPM.match(/:(\d+)/)[1]),
  };
  if (endAMPMStr == "PM" && end.hours < 12) {
    end.hours += 12;
  }
  if (endAMPMStr == "AM" && end.hours == 12) {
    end.hours = 0;
  }

  var days = toBYDAY(parsedDays); // Convert into correct format for RRULE
  var startDateTime = new Date(year, month, day, start.hours, start.minutes); // Default start/end date to the Monday the user selected
  var endDateTime = new Date(year, month, day, end.hours, end.minutes);
  // Calculate the correct starting date for each class depending on it's first meeting day.
  // e.g. if a course meets Tuesday, we add one day to the original starting day (monday)
  switch (parsedDays[0]) {
    case "Mon":
      break;
    case "Tue":
      startDateTime.setDate(startDateTime.getDate() + 1);
      endDateTime.setDate(endDateTime.getDate() + 1);
      break;
    case "Wed":
      startDateTime.setDate(startDateTime.getDate() + 2);
      endDateTime.setDate(endDateTime.getDate() + 2);
      break;
    case "Thu":
      startDateTime.setDate(startDateTime.getDate() + 3);
      endDateTime.setDate(endDateTime.getDate() + 3);
      break;
    case "Fri":
      startDateTime.setDate(startDateTime.getDate() + 4);
      endDateTime.setDate(endDateTime.getDate() + 4);
      break;
  }

  var endMonth = untilDate.getMonth();
  var endDay = untilDate.getDay();
  if (endMonth + 1 < 10) {
    endMonth = "0" + "" + (endMonth + 1);
  } else {
    endMonth = endMonth + 1;
  }
  var endDay = untilDate.getDate();
  if (endDay < 10) {
    endDay = "0" + "" + endDay;
  }
  console.log(untilDate.getFullYear() + "" + endMonth + "" + endDay);
  // Format the calendar event into a proper request
  var event = {
    kind: "calendar#event",
    summary: courseName + " " + parsedName,
    location: parsedLocation,
    start: {
      dateTime: startDateTime.toISOString(),
      timeZone: "America/Edmonton",
    },
    end: {
      dateTime: endDateTime.toISOString(),
      timeZone: "America/Edmonton",
    },
    recurrence: [
      "RRULE:FREQ=WEEKLY;UNTIL=" +
        untilDate.getFullYear() +
        "" +
        endMonth +
        "" +
        endDay +
        ";BYDAY=" +
        days,
    ],
  };
  console.log(event);
  return event;
}
function addDays(date, days) {
  var out = new Date(date.getTime());
  out.setDate(date.getDate() + days);
  return out;
}
function numDays(year, month) {
  return new Date(year, month, 0).getDate();
}
function exportToGoogle(eventArray) {
  // Content scripts cannot use chrome.* API (for authorization), so send data to an event page
  chrome.runtime.sendMessage(eventArray, function (response) {
    popupWindow.innerHTML = "Calendar exported.";
    exported = true;
  });
}
function toBYDAY(parsedDays) {
  var days = "";
  for (var i = 0; i <= parsedDays.length; i++) {
    if (i != 0) {
      days += ",";
    }
    switch (parsedDays[i]) {
      case "Mon":
        days += "MO";
        break;
      case "Tue":
        days += "TU";
        break;
      case "Wed":
        days += "WE";
        break;
      case "Thu":
        days += "TH";
        break;
      case "Fri":
        days += "FR";
        break;
    }
  }
  return days;
}
