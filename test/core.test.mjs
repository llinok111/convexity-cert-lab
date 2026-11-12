import assert from "node:assert/strict";
import {
  convexityCertificate, meshIssues, verifyWitness, verifyAll, facePlane, norm,
} from "../src/core.mjs";
import {
  cube, tetra, octahedron, bipyramid, notchedOctahedron, transform, lcg, rotatedCopy,
} from "../src/shapes.mjs";

let passed = 0;
const failures = [];
function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`ok ${passed} - ${name}`);
  } catch (err) {
    failures.push({ name, message: err.message });
    console.log(`not ok - ${name}: ${err.message}`);
  }
}

check("unit cube is certified convex with 96 vertex-face checks", () => {
  const cert = convexityCertificate(cube());
  assert.equal(cert.ok, true);
  assert.equal(cert.convex, true);
  assert.equal(cert.violationCount, 0);
  assert.equal(cert.checked, 96);
});

check("cube topology is closed, oriented, spherical (V-E+F=2)", () => {
  const issues = meshIssues(cube());
  assert.equal(issues.ok, true);
  assert.equal(issues.euler, 2);
  assert.equal(issues.edges, 18);
});

check("tetrahedron is convex", () => {
  const cert = convexityCertificate(tetra());
  assert.equal(cert.convex, true);
  assert.equal(cert.checked, 16);
});

check("octahedron is convex", () => {
  const cert = convexityCertificate(octahedron());
  assert.equal(cert.convex, true);
  assert.equal(cert.checked, 48);
});

check("pentagonal bipyramid is convex", () => {
  const cert = convexityCertificate(bipyramid(5));
  assert.equal(cert.convex, true);
  assert.equal(cert.checked, 70);
});

check("notched octahedron is rejected and yields a verifiable witness", () => {
  const mesh = notchedOctahedron(-0.3);
  const cert = convexityCertificate(mesh);
  assert.equal(cert.convex, false);
  assert.ok(cert.violationCount > 0);
  const v = verifyWitness(mesh, cert.witness);
  assert.equal(v.ok, true);
  assert.ok(v.recomputedDistance > v.tolerance);
});

check("witness verifier recomputes from indices and rejects a tampered vertex", () => {
  const mesh = notchedOctahedron(-0.3);
  const cert = convexityCertificate(mesh);
  const tampered = { ...cert.witness, vertex: cert.witness.faceVertices[0] };
  const v = verifyWitness(mesh, tampered);
  assert.equal(v.ok, false);
  assert.equal(v.why, "vertex-is-on-the-face");
});

check("convex claim is re-derived, not trusted", () => {
  const mesh = cube();
  const cert = convexityCertificate(mesh);
  const v = verifyAll(mesh, cert);
  assert.equal(v.ok, true);
  assert.equal(v.rechecked, 96);
});

check("open mesh is refused before any convexity claim", () => {
  const mesh = cube();
  mesh.faces.pop();
  const cert = convexityCertificate(mesh);
  assert.equal(cert.ok, false);
  assert.equal(cert.convex, null);
  assert.match(cert.reason, /non-manifold-edge|non-spherical-topology/);
});

check("inconsistent winding is refused", () => {
  const mesh = cube();
  mesh.faces[0] = [mesh.faces[0][0], mesh.faces[0][2], mesh.faces[0][1]];
  const cert = convexityCertificate(mesh);
  assert.equal(cert.ok, false);
  assert.equal(cert.reason, "inconsistent-winding");
});

check("degenerate triangle is refused", () => {
  const mesh = tetra();
  mesh.vertices[3] = [0.5, 0, 0];
  const cert = convexityCertificate(mesh);
  assert.equal(cert.ok, false);
  assert.equal(cert.reason, "degenerate-face");
});

check("relative tolerance survives 1e6 translation and 1e-6 scale", () => {
  const big = transform(cube(), { scale: 1e6, translate: [1e6, -1e6, 1e6] });
  assert.equal(convexityCertificate(big).convex, true);
  const tiny = transform(cube(), { scale: 1e-6, translate: [1e-6, 0, -1e-6] });
  assert.equal(convexityCertificate(tiny).convex, true);
});

check("50 rotated/scaled cubes: zero false positives", () => {
  const rnd = lcg(20261112);
  for (let i = 0; i < 50; i += 1) {
    const cert = convexityCertificate(rotatedCopy(cube(), rnd));
    assert.equal(cert.convex, true, `rotated cube ${i} reported non-convex`);
  }
});

check("50 rotated/scaled notched octahedra: zero false negatives, all witnesses verify", () => {
  const rnd = lcg(77123);
  for (let i = 0; i < 50; i += 1) {
    const mesh = rotatedCopy(notchedOctahedron(-0.3), rnd);
    const cert = convexityCertificate(mesh);
    assert.equal(cert.convex, false, `notched ${i} reported convex`);
    assert.equal(verifyWitness(mesh, cert.witness).ok, true, `witness ${i} failed`);
  }
});

check("face plane is unit-normal and its own vertices lie on it", () => {
  const mesh = cube();
  const p = facePlane(mesh, 0);
  assert.ok(Math.abs(norm(p.normal) - 1) < 1e-12);
  for (const idx of p.vertices) {
    const d = p.normal[0] * mesh.vertices[idx][0] + p.normal[1] * mesh.vertices[idx][1]
      + p.normal[2] * mesh.vertices[idx][2] - p.offset;
    assert.ok(Math.abs(d) < 1e-12);
  }
});

const total = passed + failures.length;
console.log(`\n${passed}/${total} assertions passed`);
if (failures.length) {
  for (const f of failures) console.error(`FAIL ${f.name}: ${f.message}`);
  process.exit(1);
}
