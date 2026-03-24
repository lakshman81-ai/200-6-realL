# New Ray Concept Pipeline — Technical Logic Reference
> Generated: 24-03-2026 | Ver 24-03-2026 (4)

---

## Architecture Overview

The New Ray Concept is a **100% independent** 4-stage PCF generation pipeline. It has zero dependency on the main application state. All configuration is centralised in `rc-config.js`. Data flows strictly forward through stages; no stage reaches back upstream.

```
Raw CSV
  │
  ▼
[Stage 1] rc-stage1-parser.js
  │  components[] (typed, with ep1/ep2/cp/bp coords)
  ▼
[Stage 2] rc-stage2-extractor.js
  │  fittingsPcfText (retained fittings only + SUPPORT stubs)
  ▼
[Stage 3] rc-stage3-ray-engine.js
  │  injectedPipes[] (bridges), connectionMap{}, orphanList[]
  ▼
[Stage 4] rc-stage4-emitter.js
  │  isoMetricPcfText (final PCF)
  ▼
Download / 3D Viewer
```

---

## Module 1 — `rc-config.js`

### Purpose
Single source of truth for every threshold, lookup table, and algorithm parameter. No other module may hardcode a numeric value.

### Key exports

| Export | Type | Description |
|---|---|---|
| `getRayConfig()` | function | Returns the live config object |
| `setRayConfig(patch)` | function | Merges a partial patch into live config |
| `resetRayConfig()` | function | Resets to compiled defaults |
| `vecSub(a,b)` | helper | `{x:a.x-b.x, y:a.y-b.y, z:a.z-b.z}` |
| `vecMag(v)` | helper | Euclidean magnitude of 3-vector |
| `vecNorm(v)` | helper | Unit vector |
| `vecDot(a,b)` | helper | Scalar dot product |
| `vecAdd / vecScale` | helpers | Standard vector arithmetic |
| `ptEq(a,b,tol)` | helper | Coordinate equality within tolerance |
| `cardinalAxes()` | helper | Returns the 6 axis direction vectors ±X ±Y ±Z |
| `computeLenAxis(ep1,ep2,cfg)` | helper | Computes LENGTH and AXIS label for PCF MESSAGE-SQUARE |
| `lookupTeeBreln(...)` | helper | ASME B16.9 TEE branch length lookup |
| `lookupOletBrlen(...)` | helper | MSS SP-97 OLET branch length lookup |
| `lookupOD(bore,cfg)` | helper | Nominal bore → outside diameter |

### Key config properties (defaults)

| Property | Default | Meaning |
|---|---|---|
| `gapFillTolerance` | 6.0 mm | Max gap a FLANGE face can stretch to close (Pass 0) |
| `rayMaxDistance` | 1,000,000 mm | Max travel distance for any ray cast |
| `boreTolMultiplier` | 0.5 | Perpendicular miss tolerance = bore × this |
| `minBoreTol` | 25 mm | Absolute floor on perpendicular tolerance |
| `deadZoneMin` | 0.5 mm | Minimum t to avoid self-hit |
| `deTypes` | `['FLANGE']` | Dead-End types: if one face connected, other is terminal |
| `fittingTypes` | `['FLANGE','BEND','TEE','VALVE','OLET','SUPPORT','REDU','FBLI']` | Types retained by Stage 2 |
| `stubPipeLength` | 1.0 mm | PIPE stub length injected for each SUPPORT |

---

## Module 2 — `rc-stage1-parser.js`

### Purpose
Parses the raw export CSV into a typed, normalised `component[]` list with 3D endpoint geometry.

### Entry point
```js
runStage1(rawCsvText, logFn) → { components[], csvText }
```

### Internal functions

| Function | Role |
|---|---|
| `parseRawCsv(text, cfg)` | Splits raw text into rows, strips whitespace, normalises headers |
| `groupByRefNo(rows, cfg)` | Groups rows by RefNo — each component may have multiple Point rows (P=0,1,2,3) |
| `resolveCoords(group, cfg)` | Maps `pointRoleMap` (0→cp, 1→ep1, 2→ep2, 3→bp) to XYZ coords |
| `buildComponent(group, cfg)` | Produces final component object with `{refNo, type, bore, ep1, ep2, cp, bp, pipelineRef}` |
| `mapCanonType(rawType, cfg)` | Converts CSV raw type (BRAN→PIPE, ELBO→BEND, FLAN→FLANGE, ANCI→SUPPORT etc.) |

### Component object schema
```js
{
  refNo:       "67133182/4841",   // unique identifier
  type:        "BEND",            // canonical PCF type
  bore:        300,               // mm (float)
  ep1:         { x, y, z },       // Point=1 coordinate
  ep2:         { x, y, z },       // Point=2 coordinate
  cp:          { x, y, z },       // Point=0 (centre/on-pipe)
  bp:          { x, y, z },       // Point=3 (branch point)
  pipelineRef: "export 67133182/3149",
  skey:        "BEBW",            // from skeyMap
  lenAxis:     { len1, axis1, len2, axis2, len3, axis3 },
  ca97:        null               // optional attribute
}
```

### Special type handling
- **OLET**: EP1 = EP2 = CP (all three at the same on-pipe coordinate; BP is the branch nozzle exit)
- **TEE**: EP1 + EP2 = run endpoints; CP = centre; BP = branch point
- **BEND**: EP1 + EP2 = tangent endpoints; CP = geometric centre of arc
- **SUPPORT (ANCI)**: EP1 = EP2 = null; CP = physical mounting location; no bore geometry

### Output: `csvText`
A 2D CSV with one row per component containing all resolved geometry — used for the "Save 2D CSV" download.

---

## Module 3 — `rc-stage2-extractor.js`

### Purpose
Filters the Stage 1 `components[]` to retain only fitting types. Injects 1mm PIPE stubs for SUPPORT components so the ray engine can find them spatially.

### Entry point
```js
runStage2(components, logFn) → { pcfText }
```

### Retention logic
```
if component.type IN fittingTypes → RETAIN
else                              → EXCLUDE (PIPE/BRAN, GASK, PCOM)
```

`fittingTypes` from config: `FLANGE, BEND, TEE, VALVE, OLET, SUPPORT, REDU, FBLI`

> **GASK / PCOM** are excluded from the Fittings PCF emitted here but are NOT excluded from Stage 3 connectivity — they still appear in `components[]` passed to Stage 3.

### SUPPORT stub injection
For each SUPPORT retained:
- Compute a 1mm UP (+Z) stub PIPE: `ep1 = cp`, `ep2 = cp + {0, 0, 1}`
- Mark stub with `_isStub: true` so ray engine treats it as non-shootable
- Append stub to fittings PCF after the SUPPORT block

### PCF output format (per fitting)
```
[MESSAGE-SQUARE]  "FLANGE, RefNo:=67141374/1620, SeqNo:1"
FLANGE
    END-POINT    1145515.9780 1034562.4210 104663.1290 300.0000
    END-POINT    1145515.9780 1034677.4200 104662.5840 300.0000
    <SKEY> FLWN
    COMPONENT-ATTRIBUTE98    1
```

---

## Module 4 — `rc-stage3-ray-engine.js`

### Purpose
The core geometric connection engine. Builds a face graph from all fitting endpoints, then runs 3 passes to discover which components are topologically adjacent. Injects bridge PIPE segments for any gaps found.

### Entry point
```js
runStage3(components, pipelineRef, logFn) →
  { injectedPipes[], connectionMap{}, orphanList[], connectionMatrix[], passStats }
```

---

### Internal Data Structures

#### Face object
Each exposed endpoint of a component becomes a **face**:
```js
{
  id:            "F12",           // unique auto-incrementing ID
  compRefNo:     "67133182/4841", // owning component
  compType:      "BEND",
  faceKey:       "ep2",           // 'ep1' | 'ep2' | 'bp'
  point:         { x, y, z },    // 3D location
  bore:          300,             // mm
  connected:     false,           // becomes true when paired
  isStub:        false,           // SUPPORT stubs — not ray targets
  _isOletDownstream: false,       // B6: OLET ep2 passthrough tag
  _passthroughDir: null           // B6: armed direction after ep1 connects
}
```

#### Face registry
- `_faces[]` — all faces in engine
- `_connections Map<faceId→faceId>` — bidirectional connection record
- `_compCpMap Map<refNo→{x,y,z}>` — true CP per TEE/OLET (for P2 branch direction)
- `_injected[]` — list of all bridge pipes created

---

### `buildFaces(components, cfg)`
Iterates Stage 1 components. For each:

| Type | Faces registered |
|---|---|
| SUPPORT | Skipped (stub PIPE registers its own faces if `_isStub`) |
| OLET | ep1 at CP, ep2 at CP (tagged `_isOletDownstream`), bp at BP coord |
| TEE | ep1 at EP1, ep2 at EP2, bp at BP coord |
| All others | ep1 at EP1, ep2 at EP2 (if present) |

Also stores `_compCpMap[refNo] = cp` for all TEE and OLET components.

---

### `resolveInitialConnections()`
Builds a spatial index `ptKey → [faceId...]` (keyed by `x.toFixed(2)_y.toFixed(2)_z.toFixed(2)`).

For every group of faces at the same coordinate:
- Skip same-component pairs (e.g., OLET ep1 ↔ ep2 — both at CP but same component)
- Skip stub–stub pairs
- **Connect** all other cross-component pairs at identical coordinates

This establishes all immediate adjacencies: FLANGE touching GASK, GASK touching another FLANGE, etc.

---

### Pass 0 — Gap Fill (`runPass0`)

**Trigger:** Mating flanges that should touch but have a small coordinate gap (≤ `gapFillTolerance` = 6mm) due to survey rounding.

**Algorithm:**
1. Filter faces: `!connected AND type IN gapFillTypes (FLANGE only)`
2. For each orphan FLANGE face, find the nearest other unconnected face within `gapFillTolerance` mm
3. **Snap** the orphan face's coordinate to the target (stretches the flange)
4. `connect(fa, fb)`

**Output:** `stats.p0 = N` (number of gap-fills applied)

---

### Pass 1 — Bridging (`runPass1`)

**Trigger:** Any unconnected, non-stub face that is NOT a branch point (faceKey ≠ 'bp').

**Algorithm per face:**

```
1. If faceKey is 'bp' → skip (handled by P2)

2. B6: If _isOletDownstream AND _passthroughDir is armed:
   → Fire ray in _passthroughDir from face.point
   → Hit? → injectBridge → continue
   (This handles the downstream connection from OLET ep2)

3. DE Early Exit (Dead-End types = FLANGE):
   If the sibling face of this component is already connected
   → This face is a terminal end (e.g., blind flange face) → skip

4. Primary ray: inferDir(face)
   → Find sibling face (ep2 if we are ep1, vice versa)
   → direction = normalize(face.point - sibling.point)
   → Fire raycast(origin=face.point, dir, excludeCompRefNo)

5. Fallback: 6-axis cardinal sweep (±X, ±Y, ±Z)
   → Fire each axis until hit found

6. Hit found? → injectBridge(face, hitFace)
   No hit?    → log miss, leave face orphan
```

**`raycast(origin, dir, excludeRefNo, cfg)` logic:**
```
for each face f in _faces:
  if f.connected → skip
  if f.isStub   → skip
  if f.compRefNo === excludeRefNo → skip (no self-hit)

  vec = f.point - origin
  t   = dot(vec, dir)           // parametric distance along ray
  if t < deadZoneMin → skip     // too close (self-zone)

  proj = dir × t
  perp = vec - proj
  perpDist = |perp|
  tol = max(f.bore × boreTolMultiplier, minBoreTol)

  if perpDist > tol → skip      // outside cone
  if t < bestT → bestT=t, bestFace=f

return bestFace (nearest hit)
```

**`injectBridge(fa, fb, pipelineRef, cfg):`**
```
_injected.push({
  ep1: fa.point, ep2: fb.point,
  bore: min(fa.bore, fb.bore),
  pipelineRef,
  fromRefNo: fa.compRefNo,   // for S4 bridge ordering
  toRefNo:   fb.compRefNo
})
connect(fa, fb)

B6 OLET Passthrough:
  if fa is OLET ep1 just connected:
    find fb's opposite OLET ep2 face (unconnected)
    compute incomingDir = normalize(connectedFace.point - partnerFace.point)
    arm ep2._passthroughDir = incomingDir
    (next P1 iteration will fire the armed passthrough ray for ep2)
```

---

### Pass 2 — Branch Resolution (`runPass2`)

**Trigger:** All unconnected faces with `faceKey === 'bp'` (TEE branch points and OLET branch nozzles).

**Algorithm per BP face:**
```
1. Get trueCP = _compCpMap[face.compRefNo]
   No CP found → skip

2. branchDir = normalize(BP.point - trueCP)
   If zero magnitude → skip

3. Primary: raycast(BP.point, branchDir, ...)
   Hit? → injectBridge → continue

4. Fallback 1: 6-axis cardinal sweep from BP
   Hit? → injectBridge → continue

5. Fallback 2: Proximity search
   For each unconnected non-stub face g:
     dist = |g.point - BP.point|
     dotVal = dot(normalize(g.point - BP.point), branchDir)
     if dotVal < 0.2 → skip (more than ~78° off branch direction)
     if dist < bestDist → bestTarget = g
   bestTarget found? → injectBridge(BP, bestTarget)
   else → log miss
```

> **Why proximity fallback exists:** For diagonal OLET/TEE branches, `normalize(BP-CP)` gives the physical nozzle orientation (often 45°). The branch pipe run may depart at a different angle. The proximity search finds the nearest geometrically eligible face regardless of direction, using the 20% dot-product alignment gate to avoid wild cross-connections.

---

### `buildConnectionMap()`
Returns `Map<refNo → {type, ep1:refNo|null, ep2:refNo|null, bp:refNo|null}>` — the full component adjacency graph. Consumed by Stage 4 and the Debug tab.

### `buildConnectionMatrix()`
Returns array of `{refNo, type, ep1, ep2, bp, status}` rows for the debug UI:
- `status: 'FULL'` — all faces connected
- `status: 'PARTIAL'` — at least one face connected
- `status: 'OPEN'` — no faces connected

---

## Module 5 — `rc-stage4-emitter.js`

### Purpose
Assembles the final isometric PCF from the Stage 1 component order plus Stage 3 bridge pipes. Handles support splitting on long bridge segments.

### Entry point
```js
runStage4(components, injectedPipes, pipelineRef, logFn) → { pcfText }
```

### Bridge ordering strategy

> **Key design decision:** Bridge pipes represent fitting-to-fitting GAPS, not the original pipe segments. Original PIPE/BRAN components in Stage 1 span full pipe section lengths including all fittings inside. Stage 4 therefore **skips all original PIPE slots** and instead emits each bridge immediately after the fitting it originates from.

```js
bridgesByFrom = Map<fromRefNo → Bridge[]>
// Built from injectedPipes[].fromRefNo

// Walk S1 order:
for comp of components:
  if comp.type === 'PIPE' → skip
  if comp.type === 'SUPPORT' and already-inline-emitted → skip
  emit(comp)
  emitBridgesFrom(comp.refNo)   // emits all bridges that started from this comp
```

### Support splitting (`supportsOnBridge`)

When `emitBridgeSplit(bridge)` is called, it first checks whether any SUPPORT components lie on the bridge segment:

```
seg    = ep2 - ep1
segLen = |seg|
sd     = seg / segLen   (unit direction)
tol    = max(bore × 0.5, minBoreTol, 1000mm)

for each SUPPORT sp in supportComps:
  tv      = sp.cp - ep1
  t       = dot(tv, sd)          // parametric position along segment
  if t ≤ 0 or t ≥ segLen → skip
  snap    = ep1 + sd × t         // nearest point on segment to sp.cp
  perpDist = |sp.cp - snap|
  if perpDist ≤ tol → hits.push({comp:sp, t, snap})

sort hits by t (ascending)
```

**Emit pattern for a split bridge:**
```
PIPE(ep1 → S1.snap) → SUPPORT(S1) → PIPE(S1.snap → S2.snap) → SUPPORT(S2) → ... → PIPE(last.snap → ep2)
```

Supports emitted inline are tracked in `inlineEmittedSupports` so the main S1 loop skips them (no duplicates).

### PCF emitters per type

| Type | PCF keyword | Special fields |
|---|---|---|
| FLANGE | `FLANGE` | END-POINT × 2, `<SKEY>`, CA97, CA98 |
| FBLI | `FLANGE` | Same as FLANGE, `<SKEY> BLFL` |
| BEND | `BEND` | END-POINT × 2, CENTRE-POINT, `<SKEY>`, ANGLE 90.0000 |
| TEE | `TEE` | END-POINT × 2, CENTRE-POINT, BRANCH1-POINT, `<SKEY>`, BrLen |
| OLET | `OLET` | CENTRE-POINT, BRANCH1-POINT, `<SKEY>` |
| VALVE | `VALVE` | END-POINT × 2, `<SKEY>` |
| REDU | `REDUCER-CONCENTRIC` | END-POINT × 2, `<SKEY> RCBW` |
| GASK | `COMPONENT` | END-POINT × 2 (passthrough, no SKEY) |
| PCOM | `COMPONENT` | END-POINT × 2 (passthrough, no SKEY) |
| SUPPORT | `SUPPORT` | CO-ORDS, `<SUPPORT_NAME>`, `<SUPPORT_GUID>` |
| PIPE (bridge) | `PIPE` | END-POINT × 2, PIPELINE-REFERENCE, MESSAGE-SQUARE with length |

---

## Module 6 — `rc-debug.js`

### Purpose
Shared debug log and Debug sub-tab UI. Receives events from all stage modules via `logFn = debugLog`.

### Key exports
| Export | Role |
|---|---|
| `debugLog(stage, event, refNo, detail)` | Appends an event to `RayDebugLog[]` |
| `clearLog()` | Resets the log |
| `getLog()` | Returns full log array |
| `renderDebugTab(container, connectionMatrix)` | Renders the debug UI with filterable event table and connection matrix |

### Log entry schema
```js
{ stage: 'S3-P1', event: 'hit', refNo: '67133182/4841', detail: { target, t, faceKey }, ts: Date }
```

---

## Module 7 — `rc-tab.js`

### Purpose
UI orchestrator. Builds the panel HTML, wires events, calls all 4 stage runners, manages state.

### State object (`rcState`)
```js
{
  rawCsvText:       null,     // raw uploaded CSV text
  rawFileName:      '',
  components:       [],       // Stage 1 output (persists across stages)
  csv2DText:        '',       // Stage 1 CSV text export
  fittingsPcfText:  '',       // Stage 2 PCF text
  connectionMatrix: [],       // Stage 3 connection matrix rows
  injectedPipes:    [],       // Stage 3 bridges
  pipelineRef:      '',       // derived from component[0].pipelineRef
  isoMetricPcfText: '',       // Stage 4 final PCF
  stageStatus: { s1, s2, s3, s4 }  // 'idle' | 'done' | 'error'
}
```

### Data passing between stages
```
runS1 → rcState.components, rcState.csv2DText
runS2 → takes rcState.components → writes rcState.fittingsPcfText
runS3 → takes rcState.components → writes rcState.injectedPipes, rcState.connectionMatrix
runS4 → takes rcState.components + rcState.injectedPipes → writes rcState.isoMetricPcfText
```

All stages share `debugLog` as their `logFn`. The debug tab reads `getLog()` to render its table.

---

## Data Flow Diagram

```
CSV Upload
    │
    ▼ rawCsvText
┌──────────────────────────────┐
│ Stage 1: Parser              │
│  parseRawCsv → groupByRefNo  │
│  → resolveCoords → buildComp │
└──────────────────────────────┘
    │ components[]  (N items, typed, with 3D coords)
    ▼
┌──────────────────────────────┐
│ Stage 2: Extractor           │
│  filter by fittingTypes      │
│  inject SUPPORT stubs        │
└──────────────────────────────┘
    │ fittingsPcfText (no pipe gaps)
    ▼
┌──────────────────────────────┐
│ Stage 3: Ray Engine          │
│  buildFaces ← components     │
│  resolveInitialConnections   │
│  Pass 0: Gap Fill            │
│  Pass 1: Bridging (ray cast) │
│  Pass 2: Branch (TEE/OLET)   │
└──────────────────────────────┘
    │ injectedPipes[]  connectionMap{}  orphanList[]
    ▼
┌──────────────────────────────┐
│ Stage 4: Emitter             │
│  skip original PIPEs         │
│  emit fittings + bridges     │
│  split bridges at supports   │
└──────────────────────────────┘
    │ isoMetricPcfText (complete, ready for ISOGEN)
    ▼
  Download / Load into 3D Viewer
```

---

## Known Remaining Issues (as of Ver 24-03-2026 (4))

| # | Issue | Status |
|---|---|---|
| P2-miss | OLET6562 branch (diagonal 45°) — proximity fallback hits wrong face (135km away) | Active investigation |
| P2-miss | TEE6329 and OLET8246 branch hits not confirmed | Need BM comparison |
| B6 passthrough | OLET EP2 fires in correct axis but misses BEND3272 (diagonal -Y/-Z) | Geometry mismatch |
| Support-split | `supportsOnBridge` returns empty for BEND6334→BEND6336 bridge | Debug trace added |
| GASK/PCOM emit | Emitting as generic COMPONENT — may need to be omitted from final PCF per spec | Verify against BM |
