class EventTime {
  constructor(dateTime, timeZone) {
    this.dateTime = dateTime;
    this.timeZone = timeZone;
  }
}

class CourseEvent {
  constructor(summary, description, start, end, recurrence) {
    this.summary = summary;
    this.description = description;
    this.start = start;
    this.end = end;
    this.recurrence = recurrence;
  }
}

class Course {
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

const createButton = (text, className, onClick) => {
  const button = document.createElement("button");
  button.className = className;
  button.textContent = text;
  button.addEventListener("click", onClick);
  return button;
};

const div = document.createElement("div");
let open = false,
  exported = false;
const popupWindow = document.createElement("div");

const parent = document.getElementsByClassName("bottom-buttons-2 noprint")[0];
parent.appendChild(div);

div.className = "dropdown inline";
const exportButton = createButton(
  "Export",
  "mdl-button mdl-js-button mdl-button--raised white-background",
  parseAndExport
);
div.appendChild(exportButton);

div.className = "dropdown inline open";
popupWindow.className = "dropdown-menu defaultcase pull-right";
popupWindow.style.textAlign = "center";

function parseAndExport() {
  if (open) {
    open = false;
    div.removeChild(popupWindow);
    return;
  }

  open = true;
  const eventArray = [];
  if (exported) {
    popupWindow.innerHTML = "Calendar exported.";
    return;
  }
  var courseContainer = document.getElementById("legend_box");
  var courses = courseContainer.getElementsByClassName("course_cell_legend"); // Element containing all courses in the schedule

  for (var i = 0; i < courses.length; i++) {
    const courseInformation = courses[i].innerText
      .split("\n")
      .filter((str) => /\w+/.test(str));
    const [semester, year] =
      courseInformation[1]?.split(":")[0]?.split(" ") || [];
    const [start, end] = courseInformation[1]?.split(":")[1]?.split("-") || [];

    const [startMonth, startDay] = start?.trim().split(" ") || [];
    const [endMonth, endDay] = end?.trim().split(" ") || [];

    const semesterStart = new Date(year, months[startMonth], startDay);
    const untilDate = new Date(year, months[endMonth], endDay);

    const parsedDays =
      courseInformation[4]
        ?.split(":")[0]
        .split(",")
        .map((n) => n.trim()) || [];

    const firstDay = calculateFirstClassDay(
      semesterStart,
      parsedDays
    ).getDate();
    const parsedTime = courseInformation[4]?.split(":").slice(1).join(":");

    const courseCode = courseInformation[0];
    const courseName = courseInformation[3];

    let calendarEvent = createEvent(
      year,
      months[startMonth],
      firstDay,
      courseCode,
      courseName,
      parsedTime,
      parsedDays,
      "E203",
      untilDate
    );
    eventArray.push(calendarEvent);
  }
  const submitButton = createButton(
    "Go!",
    "btn btn-mini white-on-navyblue",
    () => exportToGoogle(eventArray)
  );
  popupWindow.innerHTML = "";
  popupWindow.appendChild(submitButton);
  div.appendChild(popupWindow);
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
  var startDateTime = new Date(year, month, day, start.hours, start.minutes);
  var endDateTime = new Date(year, month, day, end.hours, end.minutes);

  var endMonth = untilDate.getMonth();
  if (endMonth + 1 < 10) {
    endMonth = "0" + "" + (endMonth + 1);
  } else {
    endMonth = endMonth + 1;
  }
  var endDay = untilDate.getDate();
  if (endDay < 10) {
    endDay = "0" + "" + endDay;
  }
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
  return event;
}
function calculateFirstClassDay(startDate, classDays) {
  classDays = classDays.map((n) => days[n]);
  let firstDayOfClass = 0;
  let firstDayAfterSemesterStart = classDays[0];
  for (var i = 0; i < classDays.length; i++) {
    if (classDays[i] >= startDate.getDay()) {
      firstDayAfterSemesterStart = classDays[i];
      break;
    }
  }
  if (firstDayAfterSemesterStart < startDate.getDay()) {
    firstDayOfClass = startDate.getDate() - firstDayAfterSemesterStart + 7;
  } else {
    let dayDiff = (firstDayAfterSemesterStart - startDate.getDay()) % 7;
    firstDayOfClass = startDate.getDate() + dayDiff;
  }
  return new Date(
    startDate.getFullYear(),
    startDate.getMonth(),
    firstDayOfClass
  );
}
function addDays(date, days) {
  const result = new Date(date);
  result.setDate(date.getDate() + days);
  return result;
}
function numDays(year, month) {
  return new Date(year, month, 0).getDate();
}
function exportToGoogle(eventArray) {
  chrome.runtime.sendMessage(eventArray, function (response) {
    popupWindow.innerHTML = "Calendar exported.";
    exported = true;
  });
}
function toBYDAY(parsedDays) {
  return parsedDays.map((day) => day.slice(0, 2).toUpperCase()).join(",");
}
