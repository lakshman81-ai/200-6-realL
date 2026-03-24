# 3D Viewer Explained — PCF Converter V5.1b

The **3D Viewer** tab (`js/editor/`) provides an interactive 3D representation of the parsed PCF geometry, built on **React Three Fiber (R3F)** and **Three.js**.

---

## Architecture Overview

```
viewer-tab.js (vanilla JS shell)
  └─ mountReactApp("react-root", data)   ← mounts once (singleton root)
       └─ App.jsx                         ← layout wrapper
            ├─ Canvas (R3F)
            │    ├─ Viewer3D.jsx          ← 3D scene content
            │    ├─ OrbitControls         ← mouse/touch navigation
            │    └─ CameraBridge          ← syncs camera → ViewCube + Gizmo
            ├─ ComponentInfoPanel.jsx     ← right-side collapsible panel
            ├─ ViewCube (HTML overlay)    ← top-right, 6 clickable faces
            ├─ Axis Gizmo (canvas)        ← bottom-right, X/Y/Z arrows
            ├─ PropertyPanel.jsx          ← node/stick editor (3D Editor tab only)
            └─ ValidatorPanel.jsx         ← Smart Validator & Fixer
```

**State:** All viewer state (components, selection, nodes, sticks) is managed via a **Zustand store** (`js/editor/store.js`). Vanilla JS side writes to the store; React components read from it reactively.

---

## Tab Sub-Views

### 3D View
Interactive 3D scene. Components are rendered as:

| Type | Geometry |
|:---|:---|
| PIPE / TUBE | Tube mesh from EP1 → EP2 |
| ELBOW / BEND | Two tube segments via CENTRE-POINT |
| TEE | Main run tube + branch tube from centre sphere |
| FLANGE | Wider tube mesh |
| OLET / SUPPORT | Sphere at centre point |
| All others | Sphere at EP1 |

**Click a component** → selects it, highlights in yellow, opens the Component Info Panel, and shows a label (RefNo or type).

### Data Table
Tabular view of all parsed PCF components (toggle button in toolbar). Synchronized with the 3D model — changes in 3D fix state reflect here. This table is the **single source of truth** for the **Export as PCF** button.

---

## ViewCube (Top-Right)
An HTML 3D cube that mirrors the camera orientation in real time.

- **Implementation:** `CameraBridge` component runs `useFrame()` (every render frame) and applies an inverted camera quaternion as a CSS `matrix3d()` transform to the inner cube div.
- **Clicking a face** fires `window.__pcfCameraSnap(snapDir, up)`:
  - Computes the scene bounding box.
  - Repositions the camera at `centre + snapDir × size`.
  - Snaps the `OrbitControls` target to the scene centre.
- Faces: Top, Front, Back, Left, Right, Bottom.

**Positioning:** The ViewCube offsets from the right edge by `panelWidth + 10 px`, so it automatically shifts left when the Component Info Panel is expanded (240 px) and right when collapsed (32 px). Smooth CSS `transition: right 0.22s ease`.

---

## Axis Gizmo (Bottom-Right)
A canvas element drawn every frame by `CameraBridge`:

- Projects the X (red), Y (green), Z (blue) world-space axis vectors through the current camera quaternion.
- Draws arrows from the centre of an 80 × 80 px circular canvas.
- Semi-transparent dark background circle for legibility over the scene.
- `pointerEvents: none` — informational only, no click handling.

---

## Component Info Panel (Right Side)
A collapsible panel that shows detailed data for the selected PCF component.

| Field | Source |
|:---|:---|
| **Data #** | 1-based index in the `components` array |
| **Ref No.** | Scanned from adjacent `MESSAGE-SQUARE` blocks (backward up to 20 rows, forward up to 3 rows) |
| **CSV Seq No.** | Extracted from `SeqNo:=` in adjacent MSG-SQ attrs; falls back to `window.__PCF_NORMALIZED_ROWS__` lookup |
| **Bore** | `comp.bore` (mm) |
| **Length** | 3D Euclidean distance EP1 → EP2 |
| **Next →** | Type + RefNo of the next non-MSG-SQ component in the array |
| Attributes | All `COMPONENT-ATTRIBUTE` values with friendly labels |

**Collapse:** Click the `▶ / ◀` toggle strip on the left edge. Collapse state is lifted to `App.jsx` so ViewCube and Gizmo reposition smoothly.

---

## Toolbar Buttons

| Button | Function |
|:---|:---|
| 📂 Open | Load a PCF file directly into the 3D viewer |
| 🗑 Clear | Clears all loaded components and resets the store |
| ⛶ Full Screen | Expands the viewer container to full browser window |
| ↓ Export as PCF | Regenerates PCF from the current Data Table state (appears after Generate 3D) |
| 📋 Copy | Copies the generated PCF text to clipboard |

---

## Data Flow

```
CSV input → sequencer → stitcher → viewer-tab.js
                                        │
                                   store.setComponents(components)
                                        │
                                   React re-renders Viewer3D
                                        │
                             User edits in 3D / Data Table
                                        │
                                   "Export as PCF" button
                                        │
                             TableRegenerator.regenerate()
                                        │
                                   PCF file download
```

---

## Camera Coordinate System

PCF files use **East / North / Up** coordinates. The 3D viewer maps these to Three.js space:

```
Three.js x = –PCF North (N)
Three.js y =  PCF Up    (U)
Three.js z = –PCF East  (E)
```

This mapping (`mapCoord()` in `Viewer3D.jsx`) ensures that "Up" in PCF appears as "up" on screen and the isometric default view looks correct.
