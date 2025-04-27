// Constants
const DAYS = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const MONTHS = {
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

// Classes
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

// State management
const courseColors = new Map();
let nextColorId = 1;

/**
 * Get or assign a color for a course
 * @param {string} courseCode - The course code
 * @returns {string} - The color ID
 */
function getColorForCourse(courseCode) {
  if (!courseColors.has(courseCode)) {
    courseColors.set(courseCode, nextColorId.toString());
    nextColorId = (nextColorId % 11) + 1; // Cycle through colors 1-11
  }
  return courseColors.get(courseCode);
}

/**
 * Parse the schedule data from the page
 * @returns {Array} - Array of calendar events
 */
async function parseSchedule() {
  try {
    const eventArray = [];
    const courseContainer = document.getElementById("legend_box");
    if (!courseContainer) {
      throw new Error("Could not find schedule container");
    }

    const courses =
      courseContainer.getElementsByClassName("course_cell_legend");

    const promises = Array.from(courses).map(parseCourseInfo);
    const courseInfos = await Promise.all(promises);
    for (const courseInfo of courseInfos) {
      if (courseInfo.events) {
        eventArray.push(...courseInfo.events);
      }
    }
    console.log("Final event array:", eventArray);
    return eventArray;
  } catch (error) {
    console.error("Failed to parse schedule:", error);
    throw new Error("Failed to parse schedule: " + error.message);
  }
}

/**
 * Parse information for a single course
 * @param {Element} courseElement - The course DOM element
 * @returns {Object} - Course information and events
 */
async function parseCourseInfo(courseElement) {
  const courseInformation = courseElement.innerText
    .split("\n")
    .filter((str) => /\w+/.test(str));

  const [semester, year] =
    courseInformation[1]?.split(":")[0]?.split(" ") || [];
  const [start, end] = courseInformation[1]?.split(":")[1]?.split("-") || [];

  const [startMonth, startDay] = start?.trim().split(" ") || [];
  const [endMonth, endDay] = end?.trim().split(" ") || [];

  if (!year || !startMonth || !startDay || !endMonth || !endDay) {
    throw new Error("Invalid course date information");
  }

  const semesterStart = new Date(year, MONTHS[startMonth], startDay);
  const untilDate = new Date(year, MONTHS[endMonth], endDay);

  const courseCode = courseInformation[0];
  const courseName = courseInformation[3];
  const courseEvents = await parseTimeSlots(
    courseInformation,
    courseCode,
    courseName,
    semesterStart,
    untilDate
  );

  return {
    courseCode,
    courseName,
    events: courseEvents,
  };
}

/**
 * Parse time slots for a course
 * @param {Array} courseInfo - Course information lines
 * @param {string} courseCode - The course code
 * @param {string} courseName - The course name
 * @param {Date} semesterStart - Semester start date
 * @param {Date} untilDate - End date for recurrence
 * @returns {Array} - Array of calendar events
 */
async function parseTimeSlots(
  courseInfo,
  courseCode,
  courseName,
  semesterStart,
  untilDate
) {
  const events = [];
  const timeSlots = [];
  const sections = [];

  // Parse time slots and sections
  for (let i = 4; i < courseInfo.length; i++) {
    const timeMatch = courseInfo[i]?.match(
      /(.*?)\s*:\s*(\d+:\d+\s*(?:AM|PM))\s*to\s*(\d+:\d+\s*(?:AM|PM))/
    );

    if (timeMatch) {
      const [_, daysStr, startTime, endTime] = timeMatch;
      timeSlots.push({
        days: daysStr.split(",").map((day) => day.trim()),
        time: `${startTime} to ${endTime}`,
        index: i,
      });
    }

    const sectionMatch = courseInfo[i]?.match(
      /^(?:(?:Lec|Lab|Tut)\s*\d+(?:\s*-\s*(?:Lec|Lab|Tut)\s*\d+)*)/
    );

    if (sectionMatch) {
      const sectionParts = sectionMatch[0].split(/\s*-\s*/);
      let location = "TBA";

      // Look ahead for location
      for (let j = i + 1; j < Math.min(i + 10, courseInfo.length); j++) {
        if (courseInfo[j].match(/^[A-Z]\d+$/)) {
          location = courseInfo[j];
          break;
        }
      }

      sectionParts.forEach((section) => {
        sections.push({
          name: section,
          location: location,
          index: i,
        });
      });
    }
  }

  // Match time slots with sections and create events
  await Promise.all(
    timeSlots.map(async (timeSlot) => {
      const matchedSection = sections.find(
        (section) => section.index > timeSlot.index
      );
      if (matchedSection) {
        const event = await createCalendarEvent(
          courseCode,
          courseName,
          matchedSection.name,
          timeSlot,
          matchedSection.location,
          semesterStart,
          untilDate
        );
        events.push(event);
      }
    })
  ).then(() => {
    console.log("Events created:", events);
  });
  return events;
}

/**
 * Create a calendar event
 * @param {string} courseCode - The course code
 * @param {string} courseName - The course name
 * @param {string} section - The section name
 * @param {Object} timeSlot - Time slot information
 * @param {string} location - The location
 * @param {Date} semesterStart - Semester start date
 * @param {Date} untilDate - End date for recurrence
 * @returns {Object} - Calendar event object
 */
async function createCalendarEvent(
  courseCode,
  courseName,
  section,
  timeSlot,
  location,
  semesterStart,
  untilDate
) {
  const [startTime, endTime] = timeSlot.time.split(" to ").map((t) => t.trim());
  const firstDay = calculateFirstClassDay(semesterStart, timeSlot.days);

  const start = convertTimeToDate(firstDay, startTime);
  const end = convertTimeToDate(firstDay, endTime);

  // Get the event format settings
  const settings = await new Promise((resolve) => {
    chrome.storage.sync.get(
      {
        formatBuilder: {
          title: [
            "courseCode",
            "separator",
            "section",
            "separator",
            "courseName",
          ],
          description: ["courseName", "newline", "section"],
        },
        courseColors: {},
      },
      resolve
    );
  });

  const eventData = {
    courseCode,
    courseName,
    section,
    instructor:
      document
        .querySelector(`[title*="${courseCode}"]`)
        ?.innerText.match(/Instructor:\s*([^\n]+)/)?.[1]
        ?.trim() || "TBA",
  };

  // Build the event title and description using the format builder
  const title = settings.formatBuilder.title
    .map((component) => {
      switch (component) {
        case "courseCode":
          return eventData.courseCode;
        case "section":
          return eventData.section;
        case "courseName":
          return eventData.courseName;
        case "separator":
          return " - ";
        default:
          return "";
      }
    })
    .join("");

  const description = settings.formatBuilder.description
    .map((component) => {
      switch (component) {
        case "courseName":
          return eventData.courseName;
        case "section":
          return eventData.section;
        case "instructor":
          return eventData.instructor;
        case "newline":
          return "\n";
        default:
          return "";
      }
    })
    .join("");

  // Get the color from settings or use default color assignment
  const colorId =
    settings.courseColors[courseCode] || getColorForCourse(courseCode);

  return {
    kind: "calendar#event",
    summary: title,
    description: description,
    location: location,
    start: {
      dateTime: start.toISOString(),
      timeZone: "America/Edmonton",
    },
    end: {
      dateTime: end.toISOString(),
      timeZone: "America/Edmonton",
    },
    recurrence: [
      `RRULE:FREQ=WEEKLY;UNTIL=${formatDate(untilDate)};BYDAY=${formatDays(
        timeSlot.days
      )}`,
    ],
    colorId: colorId,
  };
}

/**
 * Calculate the first class day
 * @param {Date} startDate - Semester start date
 * @param {Array} classDays - Array of class days
 * @returns {Date} - First class date
 */
function calculateFirstClassDay(startDate, classDays) {
  const startDay = startDate.getDay();
  const classDayNumbers = classDays.map((day) => DAYS[day]);

  // Find the first class day on or after the start date
  const firstClassDay =
    classDayNumbers.find((day) => day >= startDay) ?? classDayNumbers[0] + 7; // If no day found, use first day next week

  const result = new Date(startDate);
  result.setDate(startDate.getDate() + (firstClassDay - startDay));
  return result;
}

/**
 * Convert time string to Date object
 * @param {Date} date - The base date
 * @param {string} timeStr - Time string (e.g., "10:00 AM")
 * @returns {Date} - Date object with time set
 */
function convertTimeToDate(date, timeStr) {
  const [time, period] = timeStr.split(" ");
  let [hours, minutes] = time.split(":").map(Number);

  if (period === "PM" && hours < 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;

  const result = new Date(date);
  result.setHours(hours, minutes);
  return result;
}

/**
 * Format date for RRULE
 * @param {Date} date - The date to format
 * @returns {string} - Formatted date string
 */
function formatDate(date) {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

/**
 * Format days for RRULE
 * @param {Array} days - Array of day strings
 * @returns {string} - Formatted days string
 */
function formatDays(days) {
  return days.map((day) => day.slice(0, 2).toUpperCase()).join(",");
}

let isInitialized = false;

// Initialize the content script
function initialize() {
  if (isInitialized) return;
  isInitialized = true;
}

// Initialize when the DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize);
} else {
  initialize();
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!isInitialized) {
    sendResponse({ success: false, error: "Content script not initialized" });
  }

  try {
    switch (message.type) {
      case "GET_SCHEDULE":
        console.log("Received message:", message);
        parseSchedule().then((events) =>
          sendResponse({ success: true, events })
        );
        return true;

      case "GET_COURSES":
        const courseContainer = document.getElementById("legend_box");
        if (!courseContainer) {
          sendResponse({
            success: false,
            error: "Could not find schedule container",
          });
          break;
        }

        const courses =
          courseContainer.getElementsByClassName("course_cell_legend");
        const courseList = Array.from(courses).map((course) => {
          const courseInfo = course.innerText
            .split("\n")
            .filter((str) => /\w+/.test(str));
          return {
            courseCode: courseInfo[0],
            courseName: courseInfo[3],
            instructor:
              courseInfo
                .find((line) => line.includes("Instructor:"))
                ?.split(":")[1]
                ?.trim() || "TBA",
          };
        });

        sendResponse({
          success: true,
          courses: courseList,
        });
        break;
    }
  } catch (error) {
    console.error("Error handling message:", error);
    sendResponse({
      success: false,
      error: error.message || "An error occurred",
    });
  }
});
