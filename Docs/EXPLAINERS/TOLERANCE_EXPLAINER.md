# Tolerance & Thresholds Explained — PCF Converter V5.1b

This document details every configuration parameter that controls geometry interpretation, gap handling, overlap resolution, and connectivity in the PCF Converter.

All values are adjustable in **Config Tab → Connectivity Routing Mode / Common 3D Cleanup Rules**.

---

## 1. Continuity Tolerance (`continuityTolerance`)
**Default:** `25.0 mm` | Config label: *Continuity ±25 mm* (displayed in status bar)

- **Purpose:** Defines the "magnetic radius" around each endpoint. Two points within this distance are **snapped** (treated as one node). Points further apart trigger a **gap**.
- **Chain-Based Gap Fill (V5.1b):** During PCF stitching, if a `Prev→Next` chain link has a gap ≤ Continuity Tolerance, the assembler automatically stretches `EP2` of the previous component to meet `EP1` of the next (no synthetic PIPE inserted).
- **Impact:**
  - *Too small (e.g. 1 mm):* Rounding errors in CSV coordinates create false gaps.
  - *Too large (e.g. 100 mm):* Adjacent pipelines on parallel racks may merge into one routing.

---

## 2. Gap Filling (`continuityTolerance` also gates this)
**Default Gap Fill:** `±25.0 mm` (shown in status bar as *GAP FILLING ±25.0mm*)

- In **Fuzzy Mode**, gaps discovered during graph traversal that are within tolerance are bridged by snapping endpoints together.
- In **Sequential Mode**, gaps are bridged with a synthetic PIPE segment up to `sequentialMaxGap`.
- In the **Chain-Based assembler**, gaps ≤ tolerance are silently closed by coordinate adjustment (no extra PCF block).

---

## 3. Sequential Max Gap (`sequentialMaxGap`)
**Default:** `7 000 mm`

| Gap Size | Action |
|:---|:---|
| ≤ Continuity Tolerance | Snap endpoints (0 mm bridge) |
| > Tolerance and ≤ Max Gap | Insert synthetic PIPE block |
| > Max Gap | Leave disjoint — no bridge |

**Why:** Prevents "spider-web" artifacts when CSV sort order is wrong and two distant components appear adjacent.

---

## 4. Bore Tolerance (`boreTolerance`)
**Default:** `10.0 mm` (overlap resolution context); `1.0 mm` (connectivity)

- **Purpose:** Prevents connecting pipes of significantly different bore sizes unless a Reducer is implied.
- **Ratio Exception:** For short gaps (< 1 000 mm), a connection is allowed if `0.5 ≤ BoreA/BoreB ≤ 2.0` (e.g. 100 mm to 50 mm via an implicit reducer).

---

## 5. Max Segment Length (`maxSegmentLength`)
**Default:** `20 000 mm`

- **Purpose:** Splits long single-row PIPE entries into spool segments.
- *Example:* A 50 m pipe row becomes three 20 m spools + one 10 m spool.
- Applied in Sequential Mode and optionally in Fuzzy Repair Mode.

---

## 6. Model Gap Limit (`modelGapLimit`)
**Default:** `15 000 mm`

- **Purpose:** Maximum gap the Smart Validator flags as a "model error" candidate for automatic gap-filling repair.
- Gaps beyond this limit are reported but not auto-repaired.

---

## 7. Decimal Places (`decimalPlaces`)
**Default:** `4`

- Output precision for coordinates in the PCF file.
- Does not affect internal calculations (full IEEE 754 double precision throughout).

---

## 8. Common 3D Cleanup Rules (`common3DLogic`)

Each rule has an individual **ON/OFF toggle** and numeric threshold in Config.

| Rule | Default | Description |
|:---|:---:|:---|
| Max Pipe Run | `12 000 mm` | Flags single pipe segments longer than this |
| Max Overlap | `1 000 mm` | Threshold for reporting overlap issues |
| Min Pipe Size | `0 mm` | Ignores pipes shorter than this (prevents zero-length noise) |
| Min Component Size | `3 mm` | Minimum component span to include in the route |
| 3-Plane Skew Limit | `2 000 mm` | Warns when a pipe spans all three axes (X, Y, Z) simultaneously |
| 2-Plane Skew Limit | `3 000 mm` | Warns when a pipe spans two axes beyond this distance |
| Max Diagonal Gap | `6 000 mm` | Maximum gap for components with indeterminate direction (Supports, OLETs) |

---

## 9. Overlap Resolution (`overlapResolution`)

| Parameter | Default | Purpose |
|:---|:---:|:---|
| Enabled | ON | Master toggle for pipe-engulfs-fitting detection |
| Bore Tolerance | `10.0 mm` | Max bore difference to consider "on same run" |
| Min Pipe Length | `10.0 mm` | Minimum gap to generate a sub-pipe segment |
| Gap Fill Enabled | ON | Fill gaps between consecutive components with synthetic PIPE |
| Min Component Name Length | `3` | Only enforce name-mismatch rule if name ≥ this length |
