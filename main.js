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

// Map to store course codes to color IDs
const courseColors = new Map();
let nextColorId = 1;

function getColorForCourse(courseCode) {
  if (!courseColors.has(courseCode)) {
    courseColors.set(courseCode, nextColorId.toString());
    nextColorId = (nextColorId % 11) + 1; // Cycle through colors 1-11
  }
  return courseColors.get(courseCode);
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

// Wrap the DOM manipulation in a function that runs after DOM load
function initializeExportButton() {
  const parent = document.getElementsByClassName("bottom-buttons-2 noprint")[0];
  if (!parent) {
    console.error(
      "Could not find element with class 'bottom-buttons-2 noprint'"
    );
    return;
  }

  parent.appendChild(div);

  div.className = "dropdown inline";
  const exportButton = createButton(
    "Export",
    "mdl-button mdl-js-button mdl-button--raised white-background",
    parseAndExport
  );
  div.appendChild(exportButton);
}

// Run initialization when DOM is loaded
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeExportButton);
} else {
  initializeExportButton();
}

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

  const courseContainer = document.getElementById("legend_box");
  const courses = courseContainer.getElementsByClassName("course_cell_legend");

  for (let i = 0; i < courses.length; i++) {
    const courseInformation = courses[i].innerText
      .split("\n")
      .filter((str) => /\w+/.test(str));

    console.log(courseInformation);
    const [semester, year] =
      courseInformation[1]?.split(":")[0]?.split(" ") || [];
    const [start, end] = courseInformation[1]?.split(":")[1]?.split("-") || [];

    const [startMonth, startDay] = start?.trim().split(" ") || [];
    const [endMonth, endDay] = end?.trim().split(" ") || [];

    const semesterStart = new Date(year, months[startMonth], startDay);
    const untilDate = new Date(year, months[endMonth], endDay);

    const courseCode = courseInformation[0];
    const courseName = courseInformation[3];

    // First, collect all time slots and sections
    const timeSlots = [];
    const sections = [];

    for (let j = 4; j < courseInformation.length; j++) {
      const timeMatch = courseInformation[j]?.match(
        /(.*?)\s*:\s*(\d+:\d+\s*(?:AM|PM))\s*to\s*(\d+:\d+\s*(?:AM|PM))/
      );
      if (timeMatch) {
        const [_, daysStr, startTime, endTime] = timeMatch;
        timeSlots.push({
          days: daysStr.split(",").map((day) => day.trim()),
          time: `${startTime} to ${endTime}`,
          index: j,
        });
      }

      const sectionMatch = courseInformation[j]?.match(
        /^(?:(?:Lec|Lab|Tut)\s*\d+(?:\s*-\s*(?:Lec|Lab|Tut)\s*\d+)*)/
      );
      if (sectionMatch) {
        // Split combined sections and create separate entries
        const sectionParts = sectionMatch[0].split(/\s*-\s*/);
        let location = "TBA";
        // Look ahead for location
        for (
          let k = j + 1;
          k < Math.min(j + 10, courseInformation.length);
          k++
        ) {
          if (courseInformation[k].match(/^[A-Z]\d+$/)) {
            location = courseInformation[k];
            break;
          }
        }

        // Add each section separately
        for (const section of sectionParts) {
          sections.push({
            name: section,
            location: location,
            index: j,
          });
        }
      }
    }

    // Match time slots with sections based on their order
    for (let j = 0; j < timeSlots.length; j++) {
      // Find the closest section that appears after the time slot
      let matchedSection = null;
      for (const section of sections) {
        if (section.index > timeSlots[j].index) {
          matchedSection = section;
          break;
        }
      }

      if (matchedSection) {
        const firstDay = calculateFirstClassDay(
          semesterStart,
          timeSlots[j].days
        ).getDate();

        const calendarEvent = createCalendarEvent(
          year,
          months[startMonth],
          firstDay,
          `${courseCode} - ${matchedSection.name}`,
          courseName,
          timeSlots[j].time,
          timeSlots[j].days,
          matchedSection.location,
          untilDate
        );

        eventArray.push(calendarEvent);
      }
    }
  }

  const submitButton = createButton(
    "Go!",
    "mdl-button mdl-js-button mdl-button--raised white-background",
    () => exportToGoogle(eventArray)
  );
  popupWindow.innerHTML = "";
  popupWindow.appendChild(submitButton);
  div.appendChild(popupWindow);
}

function convertTo24Hour(timeStr) {
  const match = timeStr.match(/^(\d+):(\d+)\s?(AM|PM)$/);
  if (!match) return null;

  let [_, hours, minutes, period] = match;
  hours = Number(hours);
  minutes = Number(minutes);

  if (period === "PM" && hours < 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;

  return { hours, minutes };
}

function createCalendarEvent(
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
  const [startTime, endTime] = parsedTime.split("to").map((t) => t.trim());
  const start = convertTo24Hour(startTime);
  const end = convertTo24Hour(endTime);

  const days = toBYDAY(parsedDays);
  const startDateTime = new Date(year, month, day, start.hours, start.minutes);
  const endDateTime = new Date(year, month, day, end.hours, end.minutes);

  const endMonth = String(untilDate.getMonth() + 1).padStart(2, "0");
  const endDay = String(untilDate.getDate()).padStart(2, "0");

  // Get course code without section info for color consistency
  const courseCodeOnly = courseName.split("-")[0].trim();
  const colorId = getColorForCourse(courseCodeOnly);

  const event = {
    kind: "calendar#event",
    summary: `${courseName} ${parsedName}`,
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
      `RRULE:FREQ=WEEKLY;UNTIL=${untilDate.getFullYear()}${endMonth}${endDay};BYDAY=${days}`,
    ],
    colorId: colorId,
  };
  console.log(event);
  return event;
}

function calculateFirstClassDay(startDate, classDays) {
  classDays = classDays.map((n) => days[n]);
  const startDay = startDate.getDay();

  // Find the first class day that's on or after the semester start
  let firstClassDay = startDate.getDate();
  let foundDay = false;

  // Check each class day to find the first occurrence
  for (let i = 0; i < classDays.length; i++) {
    const classDay = classDays[i];
    if (classDay >= startDay) {
      // If class day is on or after start day, calculate days to add
      firstClassDay = startDate.getDate() + (classDay - startDay);
      foundDay = true;
      break;
    }
  }

  // If no class day found after start day, take the first class day and add days until next week
  if (!foundDay) {
    firstClassDay = startDate.getDate() + (7 - startDay + classDays[0]);
  }

  return new Date(startDate.getFullYear(), startDate.getMonth(), firstClassDay);
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
