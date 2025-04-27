// Event Format Builder
class EventFormatBuilder {
  constructor() {
    console.log("Initializing EventFormatBuilder");
    this.components = {
      title: [],
      description: [],
    };
    this.defaultFormat = {
      title: ["courseCode", "separator", "section", "separator", "courseName"],
      description: ["courseName", "newline", "section"],
    };
  }

  setTitleComponents(components) {
    this.components.title = components;
    return this;
  }

  setDescriptionComponents(components) {
    this.components.description = components;
    return this;
  }

  buildPreview(courseData) {
    return {
      title: this.buildTitlePreview(courseData),
      description: this.buildDescriptionPreview(courseData),
    };
  }

  buildTitlePreview(courseData) {
    return this.components.title
      .map((component) => {
        switch (component) {
          case "courseCode":
            return courseData.courseCode;
          case "section":
            return courseData.section;
          case "courseName":
            return courseData.courseName;
          case "separator":
            return " - ";
          case "instructor":
            return courseData.instructor || "TBA";
          case "newline":
            return "\n";
          default:
            return "";
        }
      })
      .join(" ");
  }

  buildDescriptionPreview(courseData) {
    return this.components.description
      .map((component) => {
        switch (component) {
          case "courseCode":
            return courseData.courseCode;
          case "section":
            return courseData.section;
          case "courseName":
            return courseData.courseName;
          case "separator":
            return " - ";
          case "instructor":
            return courseData.instructor || "TBA";
          case "newline":
            return "\n";
          default:
            return "";
        }
      })
      .join(" ");
  }

  reset() {
    this.components = JSON.parse(JSON.stringify(this.defaultFormat));
    return this;
  }

  toJSON() {
    return this.components;
  }

  fromJSON(json) {
    this.components = json;
    return this;
  }
}

// Calendar Colors Manager
class CalendarColorsManager {
  constructor() {
    console.log("Initializing CalendarColorsManager");
    this.colors = new Map();
    this.colorOptions = [
      { id: "1", name: "Lavender", hex: "#7986cb" },
      { id: "2", name: "Sage", hex: "#33b679" },
      { id: "3", name: "Grape", hex: "#8e24aa" },
      { id: "4", name: "Flamingo", hex: "#e67c73" },
      { id: "5", name: "Banana", hex: "#f6c026" },
      { id: "6", name: "Tangerine", hex: "#f5511d" },
      { id: "7", name: "Peacock", hex: "#039be5" },
      { id: "8", name: "Graphite", hex: "#616161" },
      { id: "9", name: "Blueberry", hex: "#3f51b5" },
      { id: "10", name: "Basil", hex: "#0b8043" },
      { id: "11", name: "Tomato", hex: "#d60000" },
    ];
  }

  setColor(courseCode, colorId) {
    this.colors.set(courseCode, colorId);
    return this;
  }

  getColor(courseCode) {
    return this.colors.get(courseCode) || "1";
  }

  getColorInfo(colorId) {
    return this.colorOptions.find((color) => color.id === colorId);
  }

  reset() {
    this.colors.clear();
    return this;
  }

  toJSON() {
    return Object.fromEntries(this.colors);
  }

  fromJSON(json) {
    this.colors = new Map(Object.entries(json));
    return this;
  }
}

// Settings Manager
export class SettingsManager {
  constructor() {
    console.log("Initializing SettingsManager");
    try {
      this.formatBuilder = new EventFormatBuilder();
      this.colorsManager = new CalendarColorsManager();
      this.settings = {
        defaultCalendarId: "primary",
        accountEmail: "",
        formatBuilder: null,
        courseColors: null,
      };
    } catch (error) {
      console.error("Error in SettingsManager constructor:", error);
      throw error;
    }
  }

  async initialize() {
    console.log("Starting SettingsManager initialization");
    try {
      await this.loadSettings();
      console.log("Settings loaded");
      return true;
    } catch (error) {
      console.error("SettingsManager initialization failed:", error);
      throw new Error(
        `SettingsManager initialization failed: ${error.message}`
      );
    }
  }

  async loadSettings() {
    console.log("Loading settings from storage");
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.sync.get(
          {
            defaultCalendarId: "primary",
            accountEmail: "",
            formatBuilder: null,
            courseColors: null,
          },
          (items) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }

            this.settings = items;
            if (items.formatBuilder) {
              this.formatBuilder.fromJSON(items.formatBuilder);
            }
            if (items.courseColors) {
              this.colorsManager.fromJSON(items.courseColors);
            }
            resolve();
          }
        );
      } catch (error) {
        reject(error);
      }
    });
  }

  async saveSettings() {
    return new Promise((resolve) => {
      const settings = {
        defaultCalendarId: this.settings.defaultCalendarId,
        accountEmail: this.settings.accountEmail,
        formatBuilder: this.formatBuilder.toJSON(),
        courseColors: this.colorsManager.toJSON(),
      };
      chrome.storage.sync.set(settings, resolve);
    });
  }

  async setupUI() {
    console.log("Setting up UI");
    try {
      await this.setupAccountInfo();
      await this.setupFormatBuilder();
      await this.setupCourseColors();
    } catch (error) {
      console.error("Error setting up UI:", error);
      throw error;
    }
  }

  async setupAccountInfo() {
    const accountDiv = document.getElementById("current-account");

    await chrome.identity.getProfileUserInfo((userInfo) => {
      if (userInfo.email) {
        console.log("User email:", userInfo.email);
        this.settings.accountEmail = userInfo.email;
      }
    });
    console.log("Account email:", this.settings.accountEmail);
    if (!accountDiv) {
      console.log("Account div not found, skipping account setup");
      return;
    }

    if (this.settings.accountEmail) {
      accountDiv.textContent = this.settings.accountEmail;
    }

    try {
      const { success, token } = await chrome.runtime.sendMessage({
        type: "GET_AUTH_TOKEN",
      });
      if (success && token) {
        const calendars = await this.fetchCalendars(token);
        this.populateCalendarSelect(calendars);
      }
    } catch (error) {
      console.error("Error setting up account info:", error);
      // Don't throw, just log the error
    }
  }

  async fetchCalendars(token) {
    const response = await fetch(
      "https://www.googleapis.com/calendar/v3/users/me/calendarList",
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    const data = await response.json();
    return data.items || [];
  }

  populateCalendarSelect(calendars) {
    const select = document.getElementById("calendar-select");
    select.innerHTML = "";
    calendars.forEach((calendar) => {
      const option = document.createElement("option");
      option.value = calendar.id;
      option.textContent = calendar.summary;
      select.appendChild(option);
    });
    select.value = this.settings.defaultCalendarId;
  }

  async setupFormatBuilder() {
    const titleContainer = document.getElementById("title-components");
    const descContainer = document.getElementById("description-components");

    if (!titleContainer || !descContainer) {
      console.log(
        "Format builder containers not found, skipping format builder setup"
      );
      return;
    }

    this.setupDragAndDrop();
    this.updatePreview();
  }

  async setupCourseColors() {
    const courseColors = document.getElementById("course-colors");
    if (!courseColors) {
      console.log("Course colors container not found, skipping color setup");
      return;
    }

    try {
      const courses = await this.getCurrentCourses();
      courseColors.innerHTML =
        courses.length === 0
          ? '<div class="no-courses">No courses found. Please open Schedule Builder to see your courses.</div>'
          : "";

      courses.forEach((course) => {
        const colorItem = this.createCourseColorItem(course);
        courseColors.appendChild(colorItem);
      });
    } catch (error) {
      console.error("Error setting up course colors:", error);
      courseColors.innerHTML =
        '<div class="error-message">Failed to load courses. Please try refreshing the page.</div>';
    }
  }

  async getCurrentCourses() {
    try {
      const response = await chrome.runtime.sendMessage({ type: "COURSES" });
      console.log("Service worker response: ", response);

      if (response?.success && response.courses) {
        return response.courses;
      }
    } catch (error) {
      console.error("Failed to get courses from page:", error);
    }
    return [];
  }

  createCourseColorItem(course) {
    const div = document.createElement("div");
    div.className = "course-color-item";

    const colorPreview = document.createElement("div");
    colorPreview.className = "color-preview";

    const select = document.createElement("select");
    select.className = "color-select";

    this.colorsManager.colorOptions.forEach((color) => {
      const option = document.createElement("option");
      option.value = color.id;
      option.textContent = color.name;
      select.appendChild(option);
    });

    const currentColor = this.colorsManager.getColor(course.courseCode);
    select.value = currentColor;
    colorPreview.style.backgroundColor =
      this.colorsManager.getColorInfo(currentColor).hex;

    select.addEventListener("change", (e) => {
      const colorId = e.target.value;
      this.colorsManager.setColor(course.courseCode, colorId);
      colorPreview.style.backgroundColor =
        this.colorsManager.getColorInfo(colorId).hex;
      this.saveSettings();
    });

    const label = document.createElement("div");
    label.textContent = course.courseCode;

    div.appendChild(colorPreview);
    div.appendChild(label);
    div.appendChild(select);

    return div;
  }

  setupDragAndDrop() {
    const containers = document.querySelectorAll(".drag-container");
    const components = document.querySelectorAll(".component-item");
    const cancelButtons = document.querySelectorAll(".cancel-item-btn");

    cancelButtons.forEach((button) => {
      button.addEventListener("click", this.handleCancelBtnClick.bind(this));
    });
    components.forEach((component) => {
      component.addEventListener("dragstart", this.handleDragStart.bind(this));
      component.addEventListener("dragend", this.handleDragEnd.bind(this));
    });

    containers.forEach((container) => {
      container.addEventListener("dragover", this.handleDragOver.bind(this));
      container.addEventListener("drop", this.handleDrop.bind(this));
    });
  }

  handleDragStart(e) {
    e.target.classList.add("dragging");
    e.dataTransfer.setData("text/plain", e.target.dataset.type);
  }

  handleDragEnd(e) {
    e.target.classList.remove("dragging");
  }

  handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add("drag-over");
  }

  handleCancelBtnClick(e) {
    const title = document.getElementById("title-components");
    const description = document.getElementById("description-components");
    const component = e.target.closest(".component-item");
    if (title.contains(component)) {
      title.removeChild(component);
    }
    if (description.contains(component)) {
      description.removeChild(component);
    }
    this.updateFormatFromUI();
  }

  handleDrop(e) {
    e.preventDefault();
    const componentType = e.dataTransfer.getData("text/plain");
    const container = e.currentTarget;
    container.classList.remove("drag-over");

    const component = document.createElement("span");
    component.className = "component-item";
    component.draggable = true;
    component.dataset.type = componentType;
    component.textContent = this.getComponentDisplayName(componentType);

    const cancelButton = document.createElement("button");
    cancelButton.className = "cancel-item-btn";
    cancelButton.textContent = "X";
    cancelButton.addEventListener(
      "click",
      this.handleCancelBtnClick.bind(this)
    );
    component.appendChild(cancelButton);

    container.appendChild(component);
    this.updateFormatFromUI();
  }

  getComponentDisplayName(type) {
    const names = {
      courseCode: "Course Code",
      section: "Section",
      courseName: "Course Name",
      separator: "-",
      instructor: "Instructor",
      newline: "↵",
    };
    return names[type] || type;
  }

  updateFormatFromUI() {
    const titleComponents = Array.from(
      document.getElementById("title-components").children
    ).map((el) => el.dataset.type);

    const descriptionComponents = Array.from(
      document.getElementById("description-components").children
    ).map((el) => el.dataset.type);

    this.formatBuilder
      .setTitleComponents(titleComponents)
      .setDescriptionComponents(descriptionComponents);

    this.updatePreview();
    this.saveSettings();
  }

  updatePreview() {
    const previewData = {
      courseCode: "COMP 3000",
      section: "Lec 01",
      courseName: "Operating Systems",
      instructor: "John Doe",
    };

    const preview = this.formatBuilder.buildPreview(previewData);

    document.getElementById("preview-title").textContent = preview.title;
    document.getElementById("preview-description").textContent =
      preview.description;
    document.getElementById("preview-location").textContent = "Room 101";
  }

  bindEvents() {
    // Only bind events if elements exist
    const changeAccount = document.getElementById("change-account");
    const calendarSelect = document.getElementById("calendar-select");
    const resetDefaults = document.getElementById("reset-defaults");

    if (changeAccount) {
      changeAccount.addEventListener("click", async () => {
        const { success, token } = await chrome.runtime.sendMessage({
          type: "GET_AUTH_TOKEN",
        });
        if (success && token) {
          this.setupAccountInfo();
        }
      });
    }

    if (calendarSelect) {
      calendarSelect.addEventListener("change", (e) => {
        this.settings.defaultCalendarId = e.target.value;
        this.saveSettings();
      });
    }

    if (resetDefaults) {
      resetDefaults.addEventListener("click", () => {
        this.formatBuilder.reset();
        this.colorsManager.reset();
        this.setupUI();
        this.saveSettings();
      });
    }
  }

  showSaveStatus(message, type) {
    const status = document.getElementById("save-status");
    status.textContent = message;
    status.className = `save-status show ${type}`;
    setTimeout(() => {
      status.className = "save-status";
    }, 3000);
  }
}

// Only initialize if we're on the settings page
if (document.getElementById("settings-modal")) {
  const settingsManager = new SettingsManager();
  settingsManager.initialize();
}
