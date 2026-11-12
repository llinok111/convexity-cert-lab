import { convexityCertificate, verifyWitness } from "./src/core.mjs";
import { cube, tetra, octahedron, bipyramid, notchedOctahedron, transform } from "./src/shapes.mjs";

const shapes = {
  "cube (convex)": cube(),
  "tetrahedron (convex)": tetra(),
  "octahedron (convex)": octahedron(),
  "bipyramid-5 (convex)": bipyramid(5),
  "notched octahedron": notchedOctahedron(-0.3),
};

const canvas = document.getElementById("view");
const ctx = canvas.getContext("2d");
const buttons = document.getElementById("buttons");
const verdict = document.getElementById("verdict");
const stats = document.getElementById("stats");

let current = "notched octahedron";
let angle = 0.6;

for (const name of Object.keys(shapes)) {
  const b = document.createElement("button");
  b.textContent = name;
  b.onclick = () => { current = name; render(); };
  buttons.appendChild(b);
}

function project(mesh, rotY, rotX, w, h) {
  const m = transform(mesh, { rot: [rotX, rotY, 0] });
  const scale = Math.min(w, h) * 0.34;
  return m.vertices.map(([x, y, z]) => {
    const d = 3.2 / (3.2 + z);
    return [w / 2 + x * scale * d, h / 2 - y * scale * d, z];
  });
}

function render() {
  const mesh = shapes[current];
  const w = canvas.width, h = canvas.height;
  const cert = convexityCertificate(mesh);
  const pts = project(mesh, angle, 0.35, w, h);
  ctx.clearRect(0, 0, w, h);

  // floor grid
  ctx.strokeStyle = "#16212e";
  for (let i = -6; i <= 6; i += 1) {
    ctx.beginPath(); ctx.moveTo(w / 2 + i * 42, h); ctx.lineTo(w / 2 + i * 26, h * 0.55); ctx.stroke();
  }

  const violationVertices = new Set((cert.violations || []).map((v) => v.vertex));
  ctx.lineWidth = 1.2;
  for (const f of mesh.faces) {
    const [a, b, c] = f.map((i) => pts[i]);
    const hot = cert.witness && cert.witness.faceVertices.every((v) => f.includes(v));
    ctx.strokeStyle = hot ? "#ff5d73" : "#54718d";
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.closePath();
    ctx.stroke();
  }
  for (const [i, p] of pts.entries()) {
    const bad = violationVertices.has(i);
    ctx.fillStyle = bad ? "#ff5d73" : (cert.witness && cert.witness.vertex === i ? "#ffd166" : "#3ddc97");
    ctx.beginPath(); ctx.arc(p[0], p[1], bad ? 5 : 3, 0, Math.PI * 2); ctx.fill();
  }

  if (!cert.ok) {
    verdict.textContent = `refused: ${cert.reason}`;
    verdict.className = "verdict bad";
  } else if (cert.convex) {
    verdict.textContent = "CERTIFIED CONVEX";
    verdict.className = "verdict ok";
  } else {
    verdict.textContent = "NON-CONVEX — witness found";
    verdict.className = "verdict bad";
  }

  const rows = [
    ["vertex-face checks", cert.checked ?? "—"],
    ["violations", cert.violationCount ?? "—"],
    ["tolerance", cert.tolerance !== undefined ? cert.tolerance.toExponential(2) : "—"],
  ];
  if (cert.witness) {
    const v = verifyWitness(mesh, cert.witness);
    rows.push(["witness face/vertex", `${cert.witness.face} / ${cert.witness.vertex}`]);
    rows.push(["recomputed outside", v.ok ? v.recomputedDistance.toFixed(4) : "rejected"]);
    rows.push(["independent verifier", v.ok ? "PASS" : "FAIL"]);
  }
  stats.innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");
}

function tick() {
  angle += 0.006;
  render();
  requestAnimationFrame(tick);
}

document.getElementById("view").addEventListener("click", () => { angle += 0.4; render(); });
tick();
