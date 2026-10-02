import test from "node:test";
import assert from "node:assert/strict";
import { ROADMAP_DAYS } from "../dist/roadmap-data.js";
import {
  calculateProgress,
  filterDays,
  getActiveDayIndex,
  normalizeText,
} from "../dist/roadmap-core.js";
import {
  saveNote,
  sanitizeState,
  toggleCompleted,
  toggleTask,
} from "../dist/state.js";
import { registerRoadmapTools } from "../dist/webmcp.js";

test("roadmap contains 90 continuous days with the approved boundaries", () => {
  assert.equal(ROADMAP_DAYS.length, 90);
  assert.equal(ROADMAP_DAYS[0].date, "2026-10-05");
  assert.equal(ROADMAP_DAYS.at(-1).date, "2027-01-02");

  ROADMAP_DAYS.forEach((day, index) => {
    assert.equal(day.day, index + 1);
    assert.equal(day.week, Math.floor(index / 7) + 1);
    assert.ok(day.title);
    assert.ok(day.review);
    assert.ok(day.lessons.length >= 2);
    assert.ok(day.practice);
    assert.ok(day.deliverable);
    assert.ok(day.checks.length >= 2);
    assert.ok(day.english);
    assert.ok(day.resources.length >= 1);
  });
});

test("normalizeText supports Vietnamese search without diacritics", () => {
  assert.equal(normalizeText("Tối ưu truy vấn SQL"), "toi uu truy van sql");
});

test("filterDays matches topic, title and accent-insensitive query", () => {
  const filtered = filterDays(ROADMAP_DAYS, "toi uu truy van", "SQL");
  assert.ok(filtered.length >= 1);
  assert.ok(filtered.every((day) => day.tags.includes("SQL")));
});

test("getActiveDayIndex selects first day before start and first incomplete after end", () => {
  assert.equal(getActiveDayIndex(ROADMAP_DAYS, "2026-10-02", new Set()), 0);
  assert.equal(getActiveDayIndex(ROADMAP_DAYS, "2026-11-03", new Set()), 29);
  assert.equal(getActiveDayIndex(ROADMAP_DAYS, "2027-02-01", new Set()), 0);
});

test("getActiveDayIndex selects the first incomplete day after the roadmap", () => {
  const completed = new Set(Array.from({ length: 35 }, (_, index) => index + 1));
  assert.equal(getActiveDayIndex(ROADMAP_DAYS, "2027-02-01", completed), 35);
});

test("calculateProgress returns a rounded percent without counting invalid days", () => {
  assert.deepEqual(calculateProgress(new Set([1, 2, 90, 999]), 90), {
    completed: 3,
    total: 90,
    percent: 3,
  });
});

test("sanitizeState keeps valid completion and notes while discarding corrupt values", () => {
  const state = sanitizeState({
    completed: [1, 2, 2, -1, 91, "3"],
    notes: { 1: "Đã hiểu", 2: 99, 91: "ngoài lịch" },
    tasks: { 1: ["review", "practice", "review", 42], 91: ["review"] },
  }, 90);
  assert.deepEqual(state.completed, [1, 2]);
  assert.deepEqual(state.notes, { 1: "Đã hiểu" });
  assert.deepEqual(state.tasks, { 1: ["review", "practice"] });
});

test("toggleCompleted is immutable and toggles only valid days", () => {
  const initial = { completed: [1], notes: {} };
  const added = toggleCompleted(initial, 2, 90);
  assert.deepEqual(initial.completed, [1]);
  assert.deepEqual(added.completed, [1, 2]);
  assert.deepEqual(toggleCompleted(added, 1, 90).completed, [2]);
  assert.deepEqual(toggleCompleted(added, 999, 90), added);
});

test("saveNote trims notes, removes empty notes and ignores invalid days", () => {
  const initial = { completed: [], notes: {} };
  const saved = saveNote(initial, 5, "  Ghi nhớ transaction  ", 90);
  assert.deepEqual(saved.notes, { 5: "Ghi nhớ transaction" });
  assert.deepEqual(saveNote(saved, 5, "   ", 90).notes, {});
  assert.deepEqual(saveNote(saved, 100, "không lưu", 90), saved);
});

test("toggleTask stores checklist progress per day without mutating state", () => {
  const initial = { completed: [], notes: {}, tasks: {} };
  const checked = toggleTask(initial, 3, "practice", 90);
  assert.deepEqual(initial.tasks, {});
  assert.deepEqual(checked.tasks, { 3: ["practice"] });
  assert.deepEqual(toggleTask(checked, 3, "practice", 90).tasks, {});
});

test("registerRoadmapTools exposes read, completion and note actions", async () => {
  const registered = [];
  const calls = [];
  const context = { registerTool(tool) { registered.push(tool); } };
  registerRoadmapTools(context, {
    getTodayPlan: () => ({ day: 1, title: "Khởi động" }),
    setDayCompletion: (day, completed) => calls.push(["complete", day, completed]),
    saveDayNote: (day, note) => calls.push(["note", day, note]),
  }, 90);

  assert.deepEqual(registered.map((tool) => tool.name), [
    "get_today_plan",
    "set_day_completion",
    "save_day_note",
  ]);
  assert.deepEqual(await registered[0].execute({}), { day: 1, title: "Khởi động" });
  assert.deepEqual(await registered[1].execute({ day: 2, completed: true }), { day: 2, completed: true });
  assert.deepEqual(await registered[2].execute({ day: 2, note: "Ôn JWT" }), { day: 2, saved: true });
  assert.deepEqual(calls, [["complete", 2, true], ["note", 2, "Ôn JWT"]]);
});

test("WebMCP actions reject invalid day and empty note", async () => {
  const registered = [];
  registerRoadmapTools({ registerTool(tool) { registered.push(tool); } }, {
    getTodayPlan: () => ({}),
    setDayCompletion: () => {},
    saveDayNote: () => {},
  }, 90);
  await assert.rejects(() => registered[1].execute({ day: 91, completed: true }), /Ngày phải từ 1 đến 90/);
  await assert.rejects(() => registered[2].execute({ day: 1, note: "   " }), /Ghi chú không được để trống/);
});
