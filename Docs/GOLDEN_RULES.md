# Golden Rules of PCF Conversion

The PCF Converter applies a set of "Golden Rules" to ensure geometric integrity, connectivity, and data validity. These rules are applied at specific stages of the pipeline.

## 1. Input Processing & Grouping
**Stage:** `groupByRefNo` (Converter)

*   **Rule 1: Component Atomicity**
    *   Rows with the same `RefNo` are grouped into a single component.
    *   `BRAN` (Pipe) rows with `Point=1` and `Point=2` define the Start and End of a single pipe segment.
*   **Rule 2: Distinct Pipeline Protection**
    *   **Logic**: Prevent connecting components that explicitly belong to different pipelines or spools.
    *   **Check**: If `Name A` and `Name B` are both defined (not "unset"/empty) and unique (different values), the connection is **REJECTED**, even if they are sequential or geometrically coincident.
    *   **Exception**: If they are within `continuityTolerance` (25mm), the connection is **ALLOWED** (treated as a Tie-In or continuation).
    *   **Self-Run**: If Self-Run is detected (Name/Bore match but overlapping), the system should trim one of the runs rather than generating duplicate geometry.

## 2. Geometry Pipeline & Overlap Resolution
**Stage:** `resolveOverlaps` (Geometry)

*   **Rule 3: Pipe Splitting (Engulfment)**
    *   If a PIPE's start-to-end vector geometrically "engulfs" another component (e.g., a Valve inside a Pipe run), the PIPE is split into sub-pipes.
    *   *Constraint*: Splitting only occurs if the inner component is on the same axis (collinear) and has the same Bore.
*   **Rule 4: Gasket Absorption**
    *   Small gaps (typically 3mm) matching a `GASK` component are "absorbed" by extending the adjacent FLANGE or FITTING. The GASK itself is not written to PCF (as per Isogen standard).

## 3. Snapping & Gap Filling
**Stage:** `snapSequential` (Geometry)

*   **Rule 6: Continuity Tolerance**
    *   Points within `continuityTolerance` (default 25mm) are snapped together to form a perfect node.
    *   **Zero-Length Check**: A distance of 0mm is explicitly accepted as continuous (important for TEE Center connections).
*   **Rule 7: Gap Filling & Bore Ratio (Sequential Mode Only)**
    *   If a gap exceeds `continuityTolerance`, a synthetic PIPE is inserted to bridge it.
    *   **Sequential Limit**: Gap filling is capped at `7000mm`. Gaps larger than this are left open (assumed distinct spools).
    *   **Bore Ratio Logic**:
        *   For gaps **≤ 1000mm**: Connection allowed if Bore Ratio ($Bore_A / Bore_B$) is between **0.5 and 2.0**.
        *   For gaps **> 1000mm**: Strict Bore Matching (tolerance 2mm) is enforced.
    *   **Safety Guard**: Gap filling is BLOCKED if Bore check fails or `ComponentName` mismatch (Rule 2) applies.

## 4. Topology Building
**Stage:** `buildTopology` (Graph)

*   **Rule 8: Node Clustering**
    *   **Concept**: To build a graph, 3D coordinates must be hashed into discrete "Nodes".
    *   **Mechanism**:
        *   The system uses a `coordKey` generator: `Key = snap(X) | snap(Y) | snap(Z)`.
        *   `snap(val)` function rounds the coordinate to the nearest multiple of `continuityTolerance`.
        *   Example: If Tolerance=25mm, `1012mm` → `1000mm`, `1020mm` → `1025mm`.
    *   **Impact**:
        *   Components endpoints that hash to the same Key are fused into a single Topological Node.
        *   This allows the "Graph Traversal" algorithm to walk from component to component.
        *   *Warning*: If Tolerance is too large (e.g., 100mm), distinct racks might merge into a single node (short-circuit). If too small (1mm), valid connections might fail due to CSV rounding errors.

## 5. PCF Generation
**Stage:** `write*` (Converter)

*   **Rule 9: Minimum Pipe Length**
    *   Pipes shorter than `1mm` (often artifacts of rounding) may be suppressed or flagged.
*   **Rule 10: Mandatory Attributes**
    *   Every component must have specific attributes (Pressure, Temperature, Material) populated. Defaults are applied via `CaDefinitions` if CSV data is missing.
