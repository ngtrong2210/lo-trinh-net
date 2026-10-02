const pages = await (await fetch("http://127.0.0.1:9222/json/list")).json();
const page = pages.find((item) => item.type === "page" && item.url.includes("127.0.0.1:4173"));
if (!page) throw new Error("Roadmap page was not found in Chrome.");

const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let nextId = 1;
function command(method, params = {}) {
  const id = nextId++;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => {
    const listener = (event) => {
      const message = JSON.parse(event.data);
      if (message.id !== id) return;
      socket.removeEventListener("message", listener);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    };
    socket.addEventListener("message", listener);
  });
}

async function evaluate(expression) {
  const result = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

const initial = await evaluate(`({
  title: document.querySelector('.day-hero h2')?.textContent.trim(),
  days: document.querySelector('#result-count')?.textContent.trim(),
  links: document.querySelectorAll('.resource-link').length,
  overflow: document.documentElement.scrollWidth <= innerWidth
})`);

if (!initial.title || initial.days !== "90 ngày" || initial.links < 1 || !initial.overflow) {
  throw new Error(`Initial render failed: ${JSON.stringify(initial)}`);
}

await evaluate(`(() => {
  document.querySelector('#complete-day').click();
  const note = document.querySelector('#day-note');
  note.value = 'Smoke test ghi chú';
  note.dispatchEvent(new Event('input', { bubbles: true }));
  const search = document.querySelector('#search-input');
  search.value = 'toi uu truy van';
  search.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
})()`);
await new Promise((resolve) => setTimeout(resolve, 600));

const interacted = await evaluate(`({
  stored: JSON.parse(localStorage.getItem('lo-trinh-dotnet-90-ngay:v1')),
  results: document.querySelector('#result-count')?.textContent.trim()
})`);
if (!interacted.stored.completed.includes(1) || interacted.stored.notes[1] !== "Smoke test ghi chú" || interacted.results !== "1 ngày") {
  throw new Error(`Interaction failed: ${JSON.stringify(interacted)}`);
}

console.log(JSON.stringify({ initial, interacted: { completed: interacted.stored.completed, note: interacted.stored.notes[1], results: interacted.results } }));
socket.close();
