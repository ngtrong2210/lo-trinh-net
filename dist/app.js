import { ROADMAP_DAYS, ROADMAP_META } from "./roadmap-data.js";
import { calculateProgress, filterDays, getActiveDayIndex } from "./roadmap-core.js";
import { saveNote, sanitizeState, toggleCompleted, toggleTask } from "./state.js";
import { registerRoadmapTools } from "./webmcp.js";

const STORAGE_KEY = "lo-trinh-dotnet-90-ngay:v1";
const filters = [
  ["ALL", "Tất cả"],
  ["Backend", ".NET"],
  ["SQL", "SQL"],
  ["Project", "Project"],
  ["Vue", "Vue"],
  ["English", "English"],
  ["Interview", "Phỏng vấn"],
];

const elements = {
  filterRow: document.querySelector("#filter-row"),
  search: document.querySelector("#search-input"),
  resultCount: document.querySelector("#result-count"),
  weekList: document.querySelector("#week-list"),
  dayView: document.querySelector("#day-view"),
  progressRing: document.querySelector("#progress-ring"),
  progressPercent: document.querySelector("#progress-percent"),
  progressDays: document.querySelector("#progress-days"),
  todayButton: document.querySelector("#today-button"),
  toast: document.querySelector("#toast"),
};

let state = loadState();
let activeFilter = "ALL";
let searchQuery = "";
let openWeek = 1;
let toastTimer;
let noteTimer;

const todayIso = localIsoDate(new Date());
let selectedIndex = getActiveDayIndex(ROADMAP_DAYS, todayIso, new Set(state.completed));
openWeek = ROADMAP_DAYS[selectedIndex]?.week ?? 1;

function localIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function loadState() {
  try {
    return sanitizeState(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}"), ROADMAP_DAYS.length);
  } catch {
    return sanitizeState({}, ROADMAP_DAYS.length);
  }
}

function persistState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    showToast("Trình duyệt đang chặn lưu tiến độ trên thiết bị này.");
  }
}

function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  toastTimer = setTimeout(() => elements.toast.classList.remove("is-visible"), 2400);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(iso) {
  return new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));
}

function formatMinutes(minutes) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} giờ ${rest} phút` : `${hours} giờ`;
}

function getVisibleDays() {
  return filterDays(ROADMAP_DAYS, searchQuery, activeFilter);
}

function renderFilters() {
  elements.filterRow.innerHTML = filters.map(([value, label]) => `
    <button class="filter-chip" type="button" data-filter="${value}" aria-pressed="${value === activeFilter}">${label}</button>
  `).join("");
}

function renderProgress() {
  const progress = calculateProgress(new Set(state.completed), ROADMAP_DAYS.length);
  elements.progressPercent.textContent = `${progress.percent}%`;
  elements.progressDays.textContent = `${progress.completed}/${progress.total} ngày`;
  elements.progressRing.style.setProperty("--progress", `${progress.percent}%`);
  elements.progressRing.setAttribute("aria-label", `Đã hoàn thành ${progress.completed} trên ${progress.total} ngày`);
}

function renderWeeks() {
  const visibleDays = getVisibleDays();
  const visibleIds = new Set(visibleDays.map((day) => day.day));
  elements.resultCount.textContent = `${visibleDays.length} ngày`;

  if (!visibleDays.length) {
    elements.weekList.innerHTML = "";
    elements.dayView.innerHTML = `
      <div class="empty-state">
        <h2>Không tìm thấy ngày phù hợp</h2>
        <p>Thử từ khóa ngắn hơn hoặc chọn “Tất cả”.</p>
      </div>`;
    return;
  }

  const selectedDay = ROADMAP_DAYS[selectedIndex];
  if (!visibleIds.has(selectedDay.day)) {
    selectedIndex = visibleDays[0].day - 1;
    openWeek = visibleDays[0].week;
  }

  elements.weekList.innerHTML = ROADMAP_META.weekTitles.map((title, index) => {
    const week = index + 1;
    const weekDays = visibleDays.filter((day) => day.week === week);
    if (!weekDays.length) return "";
    const completedInWeek = weekDays.filter((day) => state.completed.includes(day.day)).length;
    return `
      <section class="week-block ${openWeek === week ? "is-open" : ""}" data-week="${week}">
        <button class="week-heading" type="button" aria-expanded="${openWeek === week}">
          <span>Tuần ${String(week).padStart(2, "0")}</span>
          <strong>${escapeHtml(title)}</strong>
          <small>${completedInWeek}/${weekDays.length}</small>
        </button>
        <div class="day-list">
          ${weekDays.map((day) => `
            <button class="day-nav-button ${day.day - 1 === selectedIndex ? "is-active" : ""} ${state.completed.includes(day.day) ? "is-complete" : ""}" type="button" data-day="${day.day}">
              <span class="day-number">${String(day.day).padStart(2, "0")}</span>
              <span class="day-title-mini">${escapeHtml(day.title)}</span>
              <span class="day-status" aria-hidden="true"></span>
            </button>`).join("")}
        </div>
      </section>`;
  }).join("");
}

function taskCard(key, label, title, content, wide = false) {
  const day = ROADMAP_DAYS[selectedIndex];
  const checked = (state.tasks[day.day] ?? []).includes(key);
  return `
    <section class="step-card ${wide ? "wide" : ""} ${checked ? "is-checked" : ""}">
      <input type="checkbox" data-task="${key}" ${checked ? "checked" : ""} aria-label="Đánh dấu ${escapeHtml(title)} đã xong" />
      <span class="step-label">${label}</span>
      <h3>${escapeHtml(title)}</h3>
      ${content}
    </section>`;
}

function renderDay() {
  const day = ROADMAP_DAYS[selectedIndex];
  if (!day) return;
  const taskKeys = ["review", "learn", "practice", "english", ...day.checks.map((_, index) => `check-${index}`)];
  const completedTasks = taskKeys.filter((key) => (state.tasks[day.day] ?? []).includes(key)).length;
  const isComplete = state.completed.includes(day.day);

  elements.dayView.innerHTML = `
    <header class="day-hero" data-day="${String(day.day).padStart(2, "0")}">
      <div class="day-hero-copy">
        <p class="eyebrow">${escapeHtml(day.phase)} · Tuần ${day.week}</p>
        <h2>${escapeHtml(day.title)}</h2>
        <div class="hero-meta">
          <span>Ngày ${day.day}/90</span>
          <span>${escapeHtml(formatDate(day.date))}</span>
          <span>${formatMinutes(day.minutes)}</span>
        </div>
      </div>
      <div class="hero-actions">
        <button class="complete-button ${isComplete ? "is-complete" : ""}" type="button" id="complete-day">
          ${isComplete ? "✓ Đã hoàn thành" : "Đánh dấu hoàn thành"}
        </button>
        <span class="step-progress">${completedTasks}/${taskKeys.length} mục đã tích</span>
      </div>
    </header>
    <div class="sheet-body">
      <div class="daily-grid">
        ${taskCard("review", "01 · Khởi động", "Ôn bài cũ · 15 phút", `<p>${escapeHtml(day.review)}</p>`)}
        ${taskCard("learn", "02 · Kiến thức mới", "Học có mục tiêu", `<ul>${day.lessons.map((lesson) => `<li>${escapeHtml(lesson)}</li>`).join("")}</ul>`)}
        ${taskCard("practice", "03 · Code", "Bài thực hành bắt buộc", `<p>${escapeHtml(day.practice)}</p>`, true)}
        ${taskCard("english", "04 · English", "Tiếng Anh gắn với công việc", `<p>${escapeHtml(day.english)}</p>`, true)}
      </div>

      <div class="outcome-panel">
        <section class="outcome-box">
          <h3>Đầu ra phải có</h3>
          <p>${escapeHtml(day.deliverable)}</p>
        </section>
        <section class="outcome-box">
          <h3>Project xuyên suốt</h3>
          <p>${escapeHtml(ROADMAP_META.project)}</p>
        </section>
      </div>

      <section class="resource-panel">
        <h3>Tài liệu học chính</h3>
        <div class="resource-list">
          ${day.resources.map((resource) => `
            <a class="resource-link" href="${resource.url}" target="_blank" rel="noreferrer">
              <span>${escapeHtml(resource.label)}</span><span>Mở ↗</span>
            </a>`).join("")}
        </div>
      </section>

      <section class="check-panel">
        <h3>Tự kiểm tra cuối ngày</h3>
        <div class="check-list">
          ${day.checks.map((check, index) => {
            const key = `check-${index}`;
            const checked = (state.tasks[day.day] ?? []).includes(key);
            return `<label class="check-item ${checked ? "is-checked" : ""}"><input type="checkbox" data-task="${key}" ${checked ? "checked" : ""} /><span>${escapeHtml(check)}</span></label>`;
          }).join("")}
        </div>
      </section>

      <aside class="tomorrow-box">
        <strong>Ngày mai bắt đầu thế nào?</strong>
        <p>${escapeHtml(day.tomorrow)}</p>
      </aside>

      <section class="notes-panel">
        <h3>Ghi chú cá nhân</h3>
        <textarea id="day-note" maxlength="5000" placeholder="Ghi lỗi gặp phải, điều chưa hiểu, câu hỏi cần ôn lại…" aria-label="Ghi chú cho ngày ${day.day}"></textarea>
        <div class="notes-help"><span>Tự lưu trên trình duyệt này</span><span id="note-count">0/5000</span></div>
      </section>
    </div>`;

  const note = state.notes[day.day] ?? "";
  const noteField = document.querySelector("#day-note");
  noteField.value = note;
  document.querySelector("#note-count").textContent = `${note.length}/5000`;
}

function renderAll() {
  renderFilters();
  renderProgress();
  renderWeeks();
  if (getVisibleDays().length) renderDay();
}

function selectDay(dayNumber, focus = true) {
  const nextIndex = ROADMAP_DAYS.findIndex((day) => day.day === dayNumber);
  if (nextIndex < 0) return;
  selectedIndex = nextIndex;
  openWeek = ROADMAP_DAYS[nextIndex].week;
  renderWeeks();
  renderDay();
  if (focus) {
    document.querySelector("#day-content").focus({ preventScroll: true });
    document.querySelector("#day-content").scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

elements.filterRow.addEventListener("click", (event) => {
  const button = event.target.closest("[data-filter]");
  if (!button) return;
  activeFilter = button.dataset.filter;
  renderAll();
});

elements.search.addEventListener("input", (event) => {
  searchQuery = event.target.value;
  renderWeeks();
  if (getVisibleDays().length) renderDay();
});

elements.weekList.addEventListener("click", (event) => {
  const dayButton = event.target.closest("[data-day]");
  if (dayButton) {
    selectDay(Number(dayButton.dataset.day));
    return;
  }
  const weekHeading = event.target.closest(".week-heading");
  if (!weekHeading) return;
  const week = Number(weekHeading.closest("[data-week]").dataset.week);
  openWeek = openWeek === week ? 0 : week;
  const firstVisible = getVisibleDays().find((day) => day.week === week);
  if (window.matchMedia("(max-width: 780px)").matches && firstVisible) selectDay(firstVisible.day);
  else renderWeeks();
});

elements.dayView.addEventListener("change", (event) => {
  const task = event.target.closest("[data-task]");
  if (!task) return;
  const day = ROADMAP_DAYS[selectedIndex];
  state = toggleTask(state, day.day, task.dataset.task, ROADMAP_DAYS.length);
  persistState();
  renderWeeks();
  renderDay();
});

elements.dayView.addEventListener("click", (event) => {
  if (event.target.id !== "complete-day") return;
  const day = ROADMAP_DAYS[selectedIndex];
  state = toggleCompleted(state, day.day, ROADMAP_DAYS.length);
  persistState();
  renderProgress();
  renderWeeks();
  renderDay();
  showToast(state.completed.includes(day.day) ? `Đã hoàn thành Ngày ${day.day}.` : `Đã mở lại Ngày ${day.day}.`);
});

elements.dayView.addEventListener("input", (event) => {
  if (event.target.id !== "day-note") return;
  const dayNumber = ROADMAP_DAYS[selectedIndex].day;
  const note = event.target.value;
  document.querySelector("#note-count").textContent = `${note.length}/5000`;
  clearTimeout(noteTimer);
  noteTimer = setTimeout(() => {
    state = saveNote(state, dayNumber, note, ROADMAP_DAYS.length);
    persistState();
  }, 350);
});

elements.todayButton.addEventListener("click", () => {
  selectedIndex = getActiveDayIndex(ROADMAP_DAYS, todayIso, new Set(state.completed));
  activeFilter = "ALL";
  searchQuery = "";
  elements.search.value = "";
  openWeek = ROADMAP_DAYS[selectedIndex].week;
  renderAll();
  document.querySelector("#day-content").scrollIntoView({ behavior: "smooth", block: "start" });
});

renderAll();

registerRoadmapTools(document.modelContext, {
  getTodayPlan() {
    const index = getActiveDayIndex(ROADMAP_DAYS, todayIso, new Set(state.completed));
    const day = ROADMAP_DAYS[index];
    return {
      day: day.day,
      date: day.date,
      title: day.title,
      review: day.review,
      lessons: day.lessons,
      practice: day.practice,
      deliverable: day.deliverable,
      english: day.english,
      completed: state.completed.includes(day.day),
    };
  },
  setDayCompletion(day, completed) {
    const currentlyCompleted = state.completed.includes(day);
    if (currentlyCompleted !== completed) state = toggleCompleted(state, day, ROADMAP_DAYS.length);
    persistState();
    if (ROADMAP_DAYS[selectedIndex].day === day) renderDay();
    renderProgress();
    renderWeeks();
  },
  saveDayNote(day, note) {
    state = saveNote(state, day, note, ROADMAP_DAYS.length);
    persistState();
    if (ROADMAP_DAYS[selectedIndex].day === day) renderDay();
  },
}, ROADMAP_DAYS.length);

