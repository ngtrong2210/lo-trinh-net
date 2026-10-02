const pages = await (await fetch("http://127.0.0.1:9222/json/list")).json();
const page = pages.find((item) => item.type === "page");
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});
socket.send(JSON.stringify({
  id: 1,
  method: "Runtime.evaluate",
  params: {
    expression: `JSON.stringify({
      innerWidth,
      htmlScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      workspace: (() => { const r = document.querySelector('.workspace').getBoundingClientRect(); return {x:r.x,width:r.width,right:r.right}; })(),
      sheet: (() => { const r = document.querySelector('.day-sheet').getBoundingClientRect(); return {x:r.x,width:r.width,right:r.right}; })(),
      hero: (() => { const r = document.querySelector('.day-hero').getBoundingClientRect(); return {x:r.x,width:r.width,right:r.right}; })(),
      title: (() => { const r = document.querySelector('.day-hero h2').getBoundingClientRect(); return {x:r.x,width:r.width,right:r.right,scrollWidth:document.querySelector('.day-hero h2').scrollWidth}; })()
    })`,
    returnByValue: true,
  },
}));
const result = await new Promise((resolve) => {
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id === 1) resolve(message.result.result.value);
  });
});
console.log(result);
socket.close();
