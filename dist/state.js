function validDay(day, total) {
  return Number.isInteger(day) && day >= 1 && day <= total;
}

export function sanitizeState(raw, total) {
  const source = raw && typeof raw === "object" ? raw : {};
  const completed = Array.isArray(source.completed)
    ? [...new Set(source.completed.filter((day) => validDay(day, total)))].sort((a, b) => a - b)
    : [];

  const notes = {};
  if (source.notes && typeof source.notes === "object") {
    for (const [key, value] of Object.entries(source.notes)) {
      const day = Number(key);
      if (validDay(day, total) && typeof value === "string" && value.trim()) {
        notes[day] = value.trim().slice(0, 5000);
      }
    }
  }

  const tasks = {};
  if (source.tasks && typeof source.tasks === "object") {
    for (const [key, value] of Object.entries(source.tasks)) {
      const day = Number(key);
      if (!validDay(day, total) || !Array.isArray(value)) continue;
      const taskKeys = [...new Set(value.filter((item) => typeof item === "string" && /^[a-z0-9-]+$/.test(item)))];
      if (taskKeys.length) tasks[day] = taskKeys;
    }
  }

  return { completed, notes, tasks };
}

export function toggleCompleted(state, day, total) {
  if (!validDay(day, total)) return state;
  const current = new Set(state.completed ?? []);
  current.has(day) ? current.delete(day) : current.add(day);
  return sanitizeState({ ...state, completed: [...current] }, total);
}

export function saveNote(state, day, note, total) {
  if (!validDay(day, total)) return state;
  const notes = { ...(state.notes ?? {}) };
  const cleaned = typeof note === "string" ? note.trim().slice(0, 5000) : "";
  if (cleaned) notes[day] = cleaned;
  else delete notes[day];
  return sanitizeState({ ...state, notes }, total);
}

export function toggleTask(state, day, taskKey, total) {
  if (!validDay(day, total) || typeof taskKey !== "string" || !/^[a-z0-9-]+$/.test(taskKey)) return state;
  const tasks = { ...(state.tasks ?? {}) };
  const current = new Set(tasks[day] ?? []);
  current.has(taskKey) ? current.delete(taskKey) : current.add(taskKey);
  if (current.size) tasks[day] = [...current];
  else delete tasks[day];
  return sanitizeState({ ...state, tasks }, total);
}

