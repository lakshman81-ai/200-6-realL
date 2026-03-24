# Keyword Guide for AI Explainer — PCF Converter V5.1b

Use these keywords and prompt structures to get high-quality, deep architectural explanations from an AI agent working on this codebase.

---

## 1. Persona Activation

| Keyword | When to Use |
|:---|:---|
| **"Deep Architect Mode"** | System-level analysis, trade-off review, module interaction, robustness checks |
| **"Forensic Analyst"** | Debugging data issues — *"Why did this PIPE connect to that FLANGE?"* |
| **"Algorithm Designer"** | Specific logic analysis — Snapping, Topology, Chain-order, Gap-fill |
| **"PCF Expert"** | ISOGEN PCF format questions — block structure, keyword rules, SKEY codes |

---

## 2. Request Structures That Get Better Answers

- **"Elaborate on…"** — Covers edge cases and failure modes, not just a definition.
- **"Trace the Logic"** — Step through the code path. *"Trace how a TEE block is written to PCF from a CSV row."*
- **"Explain the 'Why'"** — Design rationale. *"Why is PCOM mapped to SKIP by default?"*
- **"What breaks when…"** — Failure mode analysis. *"What breaks when Continuity Tolerance is set to 0?"*
- **"Compare X vs Y"** — Mode comparisons. *"Compare Fuzzy Single vs Chain-Based ordering for ISO output."*

---

## 3. Key Concepts to Reference

| Concept | What to Ask |
|:---|:---|
| **Topology vs Geometry** | How the spatial graph (connectivity) relates to coordinate data |
| **Tolerance Buckets** | How rounding errors are grouped into discrete spatial hash cells |
| **Chain-Based Order** | How `Prev(Target)` / `Next(Target)` links in the Data Table control PCF write order |
| **MESSAGE-SQUARE** | How `RefNo:=` and `SeqNo:=` are injected and how double-`=` is avoided |
| **Overlap Resolution** | How pipes that engulf fittings are detected and split |
| **Gap-Fill Stitching** | How small gaps (< Continuity Tolerance) are closed during PCF assembly |
| **pcf-cleaner.js** | Which PCF lines are filtered before output and why |
| **ViewCube / Gizmo** | How the camera orientation is mirrored from R3F `useThree` into HTML overlays |
| **ComponentInfoPanel** | How the selected component state is read from the Zustand store |

---

## 4. Module Map (Quick Reference)

| Feature | Key File(s) |
|:---|:---|
| CSV Parsing & Header Normalization | `js/services/csv-parser.js`, `js/input/header-mapper.js` |
| Spatial Graph & Sequencer | `js/sequencer/*.js` |
| PCF Assembly | `js/output/pcf-assembler.js`, `js/converter/header-writer.js` |
| MESSAGE-SQUARE generation | `js/converter/message-square.js` |
| Output line filtering | `js/output/pcf-cleaner.js` |
| PCF Table Form | `js/ui/pcf-table-controller.js`, `js/ui/table/TableDataBuilder.js`, `js/ui/table/TableRenderer.js` |
| 3D Viewer (React) | `js/editor/App.jsx`, `js/editor/components/Viewer3D.jsx` |
| Smart Validator | `js/editor/components/ValidatorPanel.jsx` |
| Config Defaults | `js/config/defaults.js` |
| Config UI | `js/ui/config-tab.js` |

---

## 5. Example Prompts

> *"Activate Deep Architect Mode. Trace how `continuityTolerance` gates both endpoint snapping in the sequencer AND gap-fill stitching in the pcf-assembler. Identify any edge cases where the same tolerance value might cause opposite behaviors."*

> *"Forensic Analyst: A component has `RefNo:==67130482/1664` in the PCF output (double equals). Trace the data path from CSV parsing through pcf-assembler to message-square.js to identify where the extra `=` is introduced."*

> *"Algorithm Designer: Explain the Chain-Based PCF Build Order. How does the assembler follow Prev(Target)/Next(Target) links? What happens when a chain is broken (a `Next` is null or 'N/A')?"*
