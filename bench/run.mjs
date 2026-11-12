import { writeFileSync, mkdirSync } from "node:fs";
import { convexityCertificate, verifyWitness } from "../src/core.mjs";
import {
  cube, tetra, octahedron, bipyramid, notchedOctahedron, lcg, rotatedCopy,
} from "../src/shapes.mjs";

const rnd = lcg(20261112);
const convexBase = [cube(), tetra(), octahedron(), bipyramid(5), bipyramid(7), bipyramid(9)];
const t0 = process.hrtime.bigint();
let checks = 0;
let convexCount = 0;
let falsePositive = 0;
for (let i = 0; i < 300; i += 1) {
  const mesh = rotatedCopy(convexBase[i % convexBase.length], rnd);
  const cert = convexityCertificate(mesh);
  checks += cert.checked;
  if (cert.convex) convexCount += 1;
  else falsePositive += 1;
}
const t1 = process.hrtime.bigint();

let concaveCount = 0;
let falseNegative = 0;
let witnessesOk = 0;
for (let i = 0; i < 150; i += 1) {
  const mesh = rotatedCopy(notchedOctahedron(-0.3), rnd);
  const cert = convexityCertificate(mesh);
  if (cert.convex === false) {
    concaveCount += 1;
    if (verifyWitness(mesh, cert.witness).ok) witnessesOk += 1;
  } else {
    falseNegative += 1;
  }
}
const t2 = process.hrtime.bigint();

const convexMs = Number(t1 - t0) / 1e6;
const concaveMs = Number(t2 - t1) / 1e6;
const result = {
  generated_at: new Date().toISOString(),
  node: process.version,
  seed: 20261112,
  convex_meshes: 300,
  convex_certified: convexCount,
  false_positives: falsePositive,
  concave_meshes: 150,
  concave_rejected: concaveCount,
  false_negatives: falseNegative,
  witnesses_verified: witnessesOk,
  vertex_face_checks_convex: checks,
  convex_ms: Number(convexMs.toFixed(2)),
  concave_ms: Number(concaveMs.toFixed(2)),
  checks_per_second: Math.round(checks / (convexMs / 1000)),
};
mkdirSync(new URL("./", import.meta.url), { recursive: true });
writeFileSync(new URL("./result.json", import.meta.url), JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result, null, 2));
if (falsePositive !== 0 || falseNegative !== 0 || witnessesOk !== 150) process.exit(1);
