# Mode Explainer — PCF Converter V5.1b

The PCF Converter offers three **Sequencer Modes** to handle different data quality levels, selectable from **Config → Connectivity Routing Mode**.

---

## 1. Sequential Mode (Strict CSV Order)
**Philosophy:** *"Trust the Sequence Order."*

| Property | Detail |
|:---|:---|
| **Input Order** | **Critical** — Row 1 connects to Row 2 |
| **Gap Filling** | Yes — bridges gaps with synthetic PIPE up to `sequentialMaxGap` (default 7 000 mm) |
| **Pipe Splitting** | Yes — splits runs exceeding `maxSegmentLength` |
| **Topology Hash** | N/A (linear scan) |

**Use Case:** Manually ordered take-off sheets or sketches where the sequence is reliable but coordinates may be approximate.

**Risk:** If the CSV is NOT sorted, this creates "spider-web" connections between unrelated rows.

---

## 2. Fuzzy Mode — Single Pass (Default)
**Philosophy:** *"Fix the Geometry — one pass."*

| Property | Detail |
|:---|:---|
| **Input Order** | Ignored — spatial graph determines connectivity |
| **Gap Filling** | Smart graph — fills gaps within Continuity Tolerance |
| **Pipe Splitting** | Yes (complex overlap resolution) |
| **Topology Hash** | Spatial hash grid (Tolerance Grid) |

**Behavior:**
- Builds a 3D spatial graph using tolerance-bucket hashing.
- **Overlap Resolution**: Detects pipes that engulf fittings and splits them.
- Applies the "Dominant Axis Scan" and "Path Chain" heuristics to recover connectivity in skewed/rotated models.
- **Chain-Based PCF Order** (Config toggle, default ON): After graph resolution, the PCF output order follows `Prev/Next` chain links in the Data Table rather than a coordinate DFS. This keeps the PCF sequence human-readable and ISOGEN-friendly.

**Use Case:** Messy or legacy exports with moderate coordinate errors.

---

## 3. Fuzzy Mode — Multi Pass
**Philosophy:** *"Fix the Geometry — be persistent."*

Same as Single Pass, but adds a **Pass 2** with relaxed tolerance (5×) to close difficult gaps, provided Bore and ComponentName match (safety guard).

**Use Case:** Data with large but consistent offsets, or models with tight internal gaps masked by outer tolerances.

---

## Comparison Table

| Feature | Sequential | Fuzzy Single | Fuzzy Multi |
|:---|:---:|:---:|:---:|
| Input Order Critical | **Yes** | No | No |
| Gap Filling | Yes (Max 7 m) | Yes (Smart) | **Yes (2-Pass)** |
| Pipe Splitting | Yes | Yes | Yes |
| Pass 2 Relaxed | No | No | **Yes** |
| Chain-Based PCF Order | Yes | **Yes (default)** | **Yes (default)** |
| Safety Bore/Name Check | Bore | Bore/Name | Bore/Name |

---

## Chain-Based PCF Build Order (New in V5.1b)

When enabled (Config → Connectivity Routing Mode → **Chain-Based PCF Build Order**, default **ON**):

1. After the sequencer resolves `Prev(Target)` and `Next(Target)` links in the Data Table, the assembler follows these chain links when writing the PCF file.
2. **Gap-Fill Stitching**: If two chained components have a small gap (< `Continuity Tolerance`, default 25 mm), the assembler stretches `EP2` of `Prev` to meet `EP1` of `Next` automatically.
3. When OFF, the assembler uses the original coordinate DFS (graph traversal) order.
