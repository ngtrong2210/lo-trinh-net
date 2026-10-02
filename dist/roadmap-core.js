export function normalizeText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

export function filterDays(days, query = "", tag = "ALL") {
  const normalizedQuery = normalizeText(query);
  return days.filter((day) => {
    const tagMatches = tag === "ALL" || day.tags.includes(tag);
    const searchable = normalizeText([
      day.title,
      day.phase,
      day.lessons.join(" "),
      day.practice,
      day.deliverable,
      day.english,
      day.tags.join(" "),
    ].join(" "));
    return tagMatches && (!normalizedQuery || searchable.includes(normalizedQuery));
  });
}

export function getActiveDayIndex(days, todayIso, completed = new Set()) {
  if (!days.length) return -1;
  if (todayIso < days[0].date) return 0;

  const exactIndex = days.findIndex((day) => day.date === todayIso);
  if (exactIndex >= 0) return exactIndex;

  if (todayIso > days.at(-1).date) {
    const firstIncomplete = days.findIndex((day) => !completed.has(day.day));
    return firstIncomplete >= 0 ? firstIncomplete : days.length - 1;
  }

  const nextIndex = days.findIndex((day) => day.date > todayIso);
  return nextIndex >= 0 ? nextIndex : days.length - 1;
}

export function calculateProgress(completed, total) {
  const validCompleted = [...completed].filter(
    (day) => Number.isInteger(day) && day >= 1 && day <= total,
  ).length;
  return {
    completed: validCompleted,
    total,
    percent: total ? Math.round((validCompleted / total) * 100) : 0,
  };
}

