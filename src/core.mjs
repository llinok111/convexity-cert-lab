/**
 * Convexity certificate for closed triangle meshes.
 *
 * Claim: a closed, consistently oriented triangle mesh is the boundary of a
 * convex body iff every vertex lies in the closed inner half-space of every
 * face plane (supporting-plane test).  When it is not convex we return a
 * falsifiable witness: one face plane plus one vertex that is strictly outside
 * it.  The verifier never trusts the certificate's arithmetic: it recomputes
 * the plane from the raw vertex indices.
 *
 * No dependencies.  All lengths are in the mesh's own units.
 */

export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const norm = (a) => Math.sqrt(dot(a, a));

export function meshScale(mesh) {
  let s = 0;
  for (const v of mesh.vertices) {
    s = Math.max(s, Math.abs(v[0]), Math.abs(v[1]), Math.abs(v[2]));
  }
  return s > 0 ? s : 1;
}

/**
 * Structural checks that must pass before a convexity claim is meaningful.
 * Returns {ok, errors:[{code, detail}]}.
 */
export function meshIssues(mesh) {
  const errors = [];
  const verts = mesh && mesh.vertices;
  const faces = mesh && mesh.faces;
  if (!Array.isArray(verts) || !Array.isArray(faces) || verts.length < 4 || faces.length < 4) {
    return { ok: false, errors: [{ code: "empty-or-too-small", detail: "need >=4 vertices and >=4 faces" }] };
  }
  for (let fi = 0; fi < faces.length; fi += 1) {
    const f = faces[fi];
    if (!Array.isArray(f) || f.length !== 3) {
      errors.push({ code: "bad-face-arity", detail: `face ${fi} is not a triangle` });
      continue;
    }
    for (const idx of f) {
      if (!Number.isInteger(idx) || idx < 0 || idx >= verts.length) {
        errors.push({ code: "bad-index", detail: `face ${fi} index ${idx}` });
      }
    }
    if (new Set(f).size !== 3) {
      errors.push({ code: "repeated-index", detail: `face ${fi} repeats a vertex` });
    }
    const a = verts[f[0]], b = verts[f[1]], c = verts[f[2]];
    if (!a || !b || !c) continue;
    if (norm(cross(sub(b, a), sub(c, a))) < 1e-24) {
      errors.push({ code: "degenerate-face", detail: `face ${fi} has zero area` });
    }
  }
  if (errors.length) return { ok: false, errors };

  const edges = new Map();
  for (let fi = 0; fi < faces.length; fi += 1) {
    const f = faces[fi];
    for (let e = 0; e < 3; e += 1) {
      const u = f[e];
      const v = f[(e + 1) % 3];
      const lo = Math.min(u, v);
      const hi = Math.max(u, v);
      const key = `${lo}:${hi}`;
      if (!edges.has(key)) edges.set(key, []);
      edges.get(key).push({ face: fi, dir: u < v ? 1 : -1 });
    }
  }
  for (const [key, uses] of edges) {
    if (uses.length !== 2) {
      errors.push({ code: "non-manifold-edge", detail: `edge ${key} used by ${uses.length} faces` });
    } else if (uses[0].dir + uses[1].dir !== 0) {
      errors.push({ code: "inconsistent-winding", detail: `edge ${key} has two same-direction uses` });
    }
    if (errors.length > 12) break;
  }
  if (errors.length) return { ok: false, errors };

  // Euler characteristic + one connected component (a certificate on a
  // disconnected "mesh" would be vacuous for the union of two solids).
  const parent = verts.map((_, i) => i);
  const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  for (const f of faces) {
    parent[find(f[1])] = find(f[0]);
    parent[find(f[2])] = find(f[0]);
  }
  const roots = new Set(verts.map((_, i) => find(i)));
  if (roots.size !== 1) {
    errors.push({ code: "disconnected", detail: `${roots.size} vertex components` });
  }
  const euler = verts.length - edges.size + faces.length;
  if (euler !== 2) {
    errors.push({ code: "non-spherical-topology", detail: `V-E+F=${euler}, expected 2` });
  }
  return { ok: errors.length === 0, errors, edges: edges.size, euler };
}

export function facePlane(mesh, fi) {
  const [i, j, k] = mesh.faces[fi];
  const a = mesh.vertices[i];
  const b = mesh.vertices[j];
  const c = mesh.vertices[k];
  const n = cross(sub(b, a), sub(c, a));
  const len = norm(n);
  if (!(len > 0)) return null;
  const unit = [n[0] / len, n[1] / len, n[2] / len];
  return { normal: unit, offset: dot(unit, a), area2: len, vertices: [i, j, k] };
}

/**
 * Full supporting-plane certificate.
 * eps is relative to the mesh's coordinate scale, never an absolute magic number.
 */
export function convexityCertificate(mesh, { eps = 1e-9 } = {}) {
  const issues = meshIssues(mesh);
  if (!issues.ok) {
    return {
      ok: false,
      convex: null,
      reason: issues.errors[0].code,
      issues,
      checked: 0,
      violationCount: 0,
      violations: [],
      witness: null,
    };
  }
  const tol = eps * meshScale(mesh);
  const violations = [];
  let checked = 0;
  let minSlack = Infinity;
  let worst = null;
  for (let fi = 0; fi < mesh.faces.length; fi += 1) {
    const plane = facePlane(mesh, fi);
    for (let vi = 0; vi < mesh.vertices.length; vi += 1) {
      const dist = dot(plane.normal, mesh.vertices[vi]) - plane.offset;
      checked += 1;
      if (dist < minSlack) minSlack = dist;
      if (dist > tol) {
        const rec = {
          face: fi,
          vertex: vi,
          distance: dist,
          faceVertices: plane.vertices.slice(),
          plane: { normal: plane.normal.slice(), offset: plane.offset },
        };
        violations.push(rec);
        if (!worst || dist > worst.distance) worst = rec;
      }
    }
  }
  violations.sort((x, y) => y.distance - x.distance);
  return {
    ok: true,
    convex: violations.length === 0,
    checked,
    violationCount: violations.length,
    violations: violations.slice(0, 50),
    minSlack,
    tolerance: tol,
    witness: worst,
  };
}

/**
 * Independent re-derivation of a witness from raw indices.  Returns ok only if
 * the claimed vertex is strictly outside the claimed face's plane.
 */
export function verifyWitness(mesh, witness, { eps = 1e-9 } = {}) {
  const checks = [];
  const fail = (why) => ({ ok: false, why, checks });
  if (!witness) return fail("no-witness");
  const { face, vertex } = witness;
  if (!Number.isInteger(face) || face < 0 || face >= mesh.faces.length) return fail("bad-face-index");
  if (!Number.isInteger(vertex) || vertex < 0 || vertex >= mesh.vertices.length) return fail("bad-vertex-index");
  const plane = facePlane(mesh, face);
  if (!plane) return fail("degenerate-face-plane");
  if (plane.vertices.includes(vertex)) return fail("vertex-is-on-the-face");
  const tol = eps * meshScale(mesh);
  const dist = dot(plane.normal, mesh.vertices[vertex]) - plane.offset;
  checks.push({ name: "plane-unit", value: norm(plane.normal) });
  checks.push({ name: "recomputed-distance", value: dist });
  checks.push({ name: "tolerance", value: tol });
  if (!(dist > tol)) return fail("not-strictly-outside");
  return { ok: true, recomputedDistance: dist, tolerance: tol, checks };
}

export function verifyAll(mesh, cert, opts) {
  if (!cert.ok) return { ok: false, why: "certificate-not-applicable" };
  if (cert.convex) {
    // A convex claim is checked by re-running the sweep, not by trusting it.
    const again = convexityCertificate(mesh, opts);
    return { ok: again.convex === true && again.violationCount === 0, rechecked: again.checked };
  }
  return verifyWitness(mesh, cert.witness, opts);
}
