/** Deterministic built-in meshes used by the tests, bench and browser demo. */

export function cube(size = 1, origin = [0, 0, 0]) {
  const s = size;
  const o = origin;
  const v = [
    [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
    [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1],
  ].map(([x, y, z]) => [o[0] + x * s, o[1] + y * s, o[2] + z * s]);
  const f = [
    [0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7],
    [0, 1, 5], [0, 5, 4], [3, 7, 6], [3, 6, 2],
    [0, 4, 7], [0, 7, 3], [1, 2, 6], [1, 6, 5],
  ];
  return { vertices: v, faces: f };
}

export function tetra(size = 1) {
  const v = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]]
    .map(([x, y, z]) => [x * size, y * size, z * size]);
  return { vertices: v, faces: [[0, 2, 1], [0, 1, 3], [1, 2, 3], [2, 0, 3]] };
}

export function octahedron(radius = 1) {
  const r = radius;
  const v = [[r, 0, 0], [-r, 0, 0], [0, r, 0], [0, -r, 0], [0, 0, r], [0, 0, -r]];
  const f = [
    [0, 2, 4], [2, 1, 4], [1, 3, 4], [3, 0, 4],
    [2, 0, 5], [1, 2, 5], [3, 1, 5], [0, 3, 5],
  ];
  return { vertices: v, faces: f };
}

/** Convex n-gonal bipyramid: 2 apexes + n equatorial vertices. */
export function bipyramid(n = 5, radius = 1, height = 1) {
  const v = [[0, 0, height], [0, 0, -height]];
  for (let i = 0; i < n; i += 1) {
    const a = (2 * Math.PI * i) / n;
    v.push([radius * Math.cos(a), radius * Math.sin(a), 0]);
  }
  const f = [];
  for (let i = 0; i < n; i += 1) {
    const p = 2 + i;
    const q = 2 + ((i + 1) % n);
    f.push([p, q, 0]); // top fan, counter-clockwise seen from +z
    f.push([q, p, 1]); // bottom fan, reversed
  }
  return { vertices: v, faces: f };
}

/** Octahedron with the +x apex pulled through the opposite facet: non-convex. */
export function notchedOctahedron(scale = -0.3) {
  const m = octahedron(1);
  m.vertices[0] = [scale, 0, 0];
  return m;
}

export function transform(mesh, { rot = [0, 0, 0], scale = 1, translate = [0, 0, 0] } = {}) {
  const [rx, ry, rz] = rot;
  const cx = Math.cos(rx), sx = Math.sin(rx);
  const cy = Math.cos(ry), sy = Math.sin(ry);
  const cz = Math.cos(rz), sz = Math.sin(rz);
  const vertices = mesh.vertices.map(([x, y, z]) => {
    let a = x * scale, b = y * scale, c = z * scale;
    // Rx
    let b2 = b * cx - c * sx;
    let c2 = b * sx + c * cx;
    b = b2; c = c2;
    // Ry
    let a2 = a * cy + c * sy;
    c2 = -a * sy + c * cy;
    a = a2; c = c2;
    // Rz
    a2 = a * cz - b * sz;
    b2 = a * sz + b * cz;
    a = a2; b = b2;
    return [a + translate[0], b + translate[1], c + translate[2]];
  });
  return { vertices, faces: mesh.faces.map((f) => f.slice()) };
}

/** Small deterministic LCG so every run and replay sees the same rotations. */
export function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function rotatedCopy(mesh, rnd, maxAngle = Math.PI) {
  return transform(mesh, {
    rot: [rnd() * maxAngle, rnd() * maxAngle, rnd() * maxAngle],
    scale: 0.5 + rnd() * 2,
    translate: [(rnd() - 0.5) * 10, (rnd() - 0.5) * 10, (rnd() - 0.5) * 10],
  });
}
