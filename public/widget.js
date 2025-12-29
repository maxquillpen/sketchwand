const canvas = document.getElementById("sketchCanvas");
const undoButton = document.getElementById("undoButton");
const clearButton = document.getElementById("clearButton");
const pointerStatus = document.getElementById("pointerStatus");
const pointsStatus = document.getElementById("pointsStatus");

const ctx = canvas.getContext("2d");

const strokes = [];
let currentStroke = null;

const penConfig = {
  width: 4,
  color: "#111",
};

const updateDebug = (event, totalPoints) => {
  if (!event) {
    pointerStatus.textContent = "-";
    pointsStatus.textContent = totalPoints;
    return;
  }

  pointerStatus.textContent = `${event.type} | ${event.pointerType} | p:${event.pressure.toFixed(2)}`;
  pointsStatus.textContent = totalPoints;
};

const getCanvasPoint = (event) => {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
    p: event.pressure || 0.5,
    t: event.timeStamp,
  };
};

const resizeCanvas = () => {
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * ratio));
  canvas.height = Math.max(1, Math.floor(rect.height * ratio));
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  redraw();
};

const drawStroke = (stroke) => {
  const { points, width, color } = stroke;
  if (points.length === 0) return;

  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  if (points.length === 1) {
    ctx.lineTo(points[0].x, points[0].y);
    ctx.stroke();
    return;
  }

  for (let i = 1; i < points.length - 1; i += 1) {
    const current = points[i];
    const next = points[i + 1];
    const midX = (current.x + next.x) / 2;
    const midY = (current.y + next.y) / 2;
    ctx.quadraticCurveTo(current.x, current.y, midX, midY);
  }

  const lastPoint = points[points.length - 1];
  ctx.lineTo(lastPoint.x, lastPoint.y);
  ctx.stroke();
};

const redraw = () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  strokes.forEach(drawStroke);
  const totalPoints = strokes.reduce((sum, stroke) => sum + stroke.points.length, 0);
  updateDebug(null, totalPoints);
};

const startStroke = (event) => {
  event.preventDefault();
  canvas.setPointerCapture(event.pointerId);

  currentStroke = {
    tool: "pen",
    width: penConfig.width,
    color: penConfig.color,
    points: [getCanvasPoint(event)],
  };

  strokes.push(currentStroke);
  updateDebug(event, currentStroke.points.length);
  redraw();
};

const moveStroke = (event) => {
  if (!currentStroke) return;
  event.preventDefault();

  currentStroke.points.push(getCanvasPoint(event));
  updateDebug(event, currentStroke.points.length);
  redraw();
};

const endStroke = (event) => {
  if (!currentStroke) return;
  event.preventDefault();
  currentStroke = null;
  updateDebug(event, strokes.reduce((sum, stroke) => sum + stroke.points.length, 0));
  redraw();
};

canvas.addEventListener("pointerdown", startStroke);
canvas.addEventListener("pointermove", moveStroke);
canvas.addEventListener("pointerup", endStroke);
canvas.addEventListener("pointercancel", endStroke);
canvas.addEventListener("pointerleave", endStroke);

undoButton.addEventListener("click", () => {
  strokes.pop();
  redraw();
});

clearButton.addEventListener("click", () => {
  strokes.length = 0;
  redraw();
});

const resizeObserver = new ResizeObserver(resizeCanvas);
resizeObserver.observe(canvas);

window.addEventListener("resize", resizeCanvas);

resizeCanvas();
