function requireDay(value, total) {
  if (!Number.isInteger(value) || value < 1 || value > total) {
    throw new Error(`Ngày phải từ 1 đến ${total}.`);
  }
  return value;
}

export function registerRoadmapTools(context, actions, total) {
  if (!context?.registerTool) return [];
  const tools = [
    {
      name: "get_today_plan",
      title: "Xem kế hoạch học hôm nay",
      description: "Đọc nội dung ngày học phù hợp với ngày hiện tại và tiến độ trên thiết bị.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      async execute() {
        return actions.getTodayPlan();
      },
    },
    {
      name: "set_day_completion",
      title: "Cập nhật trạng thái ngày học",
      description: "Đánh dấu một ngày trong lộ trình là đã hoàn thành hoặc chưa hoàn thành.",
      inputSchema: {
        type: "object",
        properties: {
          day: { type: "integer", minimum: 1, maximum: total },
          completed: { type: "boolean" },
        },
        required: ["day", "completed"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute(input) {
        const day = requireDay(input?.day, total);
        if (typeof input?.completed !== "boolean") throw new Error("Trạng thái completed phải là true hoặc false.");
        actions.setDayCompletion(day, input.completed);
        return { day, completed: input.completed };
      },
    },
    {
      name: "save_day_note",
      title: "Lưu ghi chú ngày học",
      description: "Lưu ghi chú cá nhân cho một ngày trong lộ trình trên thiết bị hiện tại.",
      inputSchema: {
        type: "object",
        properties: {
          day: { type: "integer", minimum: 1, maximum: total },
          note: { type: "string", minLength: 1, maxLength: 5000 },
        },
        required: ["day", "note"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      async execute(input) {
        const day = requireDay(input?.day, total);
        const note = typeof input?.note === "string" ? input.note.trim() : "";
        if (!note) throw new Error("Ghi chú không được để trống.");
        actions.saveDayNote(day, note);
        return { day, saved: true };
      },
    },
  ];

  for (const tool of tools) {
    try {
      void Promise.resolve(context.registerTool(tool)).catch(() => {});
    } catch {
      // WebMCP is optional; the visible experience remains fully functional.
    }
  }
  return tools;
}

