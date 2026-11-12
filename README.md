# convexity-cert-lab

**A closed triangle mesh gets one of three answers — CONVEX, NON-CONVEX with a falsifying witness, or REFUSED — never a guess.**

Measured on this machine (Node v24.19.0, seed `20261112`):

- **300/300** randomly rotated/scaled convex meshes certified convex, **0 false positives**
- **150/150** rotated non-convex meshes refuted, **0 false negatives**, **150/150** witnesses independently re-verified
- **27,700** vertex–face checks in **15.06 ms** → **1,839,099 checks/s**
- test suite: **15/15 assertions passed** (`node test/core.test.mjs`)

`Upstream:` 原创

## What it actually decides

For a closed, consistently oriented, connected triangle mesh, the tool tests the
supporting-plane condition: every vertex must lie in the closed inner half-space
of every face plane. It then does the part most checkers skip:

- **Refusal before claims.** Open boundaries, non-manifold edges, inconsistent
  winding, repeated indices, zero-area triangles, disconnected components and
  non-spherical topology (V−E+F ≠ 2) are reported first; `convex` stays `null`
  instead of returning a meaningless boolean.
- **A witness, not a score.** When a vertex is strictly outside a face plane it
  returns the face index, vertex index, face vertices, unit plane, signed
  distance and the relative tolerance. `verifyWitness()` recomputes everything
  from raw vertex indices and rejects tampered witnesses (`vertex-is-on-the-face`, `not-strictly-outside`, bad indices).
- **Relative tolerance.** `eps = 1e-9` is multiplied by the mesh's coordinate
  scale, so a 1e6-translated cube and a 1e-6-scaled cube both certify correctly.
  There is no absolute magic epsilon.
- **Convex claims are re-derived** by `verifyAll()`, not trusted from the
  certificate object.

## Run it

```bash
node test/core.test.mjs      # 15/15 assertions
node bench/run.mjs           # writes bench/result.json, exits non-zero on any FP/FN
python3 -m http.server 4173  # then open http://localhost:4173/
```

Browser demo: click a shape; red vertices are the witnesses, the red face is the
plane they violate. The panel shows the independently recomputed distance.

## API

```js
import { convexityCertificate, verifyWitness, verifyAll } from "./src/core.mjs";

const cert = convexityCertificate(mesh, { eps: 1e-9 });
// { ok, convex, checked, violationCount, violations, minSlack, tolerance, witness }
verifyWitness(mesh, cert.witness);  // { ok, recomputedDistance, tolerance, checks }
verifyAll(mesh, cert);              // re-runs the sweep / the witness check
```

Mesh format: `{ vertices: [[x,y,z], ...], faces: [[i,j,k], ...] }`, outward
counter-clockwise winding.

## Honest limits

- The certificate is only as strong as the input topology checks. A
  self-intersecting mesh that still passes the edge/Euler checks is refused only
  if its winding is inconsistent; global self-intersection is **not** detected.
- The supporting-plane sweep is O(F·V). That is fine for the ≤ a few thousand
  triangles this tool targets; it is not a BVH-accelerated broadphase.
- `minSlack` is the deepest signed distance found, not a distance to the convex
  hull.

## 本轮创新

第一次把「凸性判定」做成**可证伪的三值证书**：拒绝在拓扑不成立时给布尔值；
非凸时返回「面平面 + 严格在外顶点」的可独立重算见证；凸时用相对尺度容差
重跑支持平面扫描而不是信任证书对象。浏览器端与 node 端共用同一 `src/core.mjs`，
演示里的每个红点都对应 `verifyWitness()` 重算通过的见证。台账无「凸性证书 +
见证反算 + 拓扑拒绝」这一组合。

## License

MIT
