# Smart Modules Explained — PCF Converter V5.1b

The PCF Converter integrates several "Smart" modules that intelligently process, link, and enrich piping data. These modules handle fuzzy matching, master data lookup, logic-based attribute derivation, and 3D geometry validation.

---

## 1. Smart Process Logic (Linelist Service)
**Module:** `js/services/linelist-service.js`

Connects input CSV rows to an external Line List (Master Process Data sheet).

### Fuzzy Header Matching
Automatically identifies relevant columns even when header names vary:
1. Scans all Linelist headers.
2. Tests **exact match** against a keyword dictionary (`js/config/defaults.js → smartProcessKeywords`).
3. Falls back to **case-insensitive substring match** if no exact hit.
   - *Example:* `"Op. Pressure"`, `"Design P (kPa)"`, and `"Pressure P1"` all resolve to `Pressure`.

### Line Number Matching
Extracts a clean pipeline reference from `RefNo` to link to the Linelist:
- **Token strategy:** Splits `RefNo` by a delimiter (e.g. `-`) and takes a specific token index (configurable).
- **Regex strategy:** Captures a pattern like `([A-Z]{2}-[0-9]+-[0-9]+)` from the RefNo string.
- **Fallback:** Simple string lookup if both strategies fail.

### Density & Phase Logic
Determines fluid density from the Line List `Phase` column:
| Phase | Source |
|:---|:---|
| Gas | `Gas Density` column |
| Liquid | `Liquid Density` column |
| Mixed | Configurable preference (default: Liquid) |
| Undefined | Default 1 000 kg/m³ (Water) |

---

## 2. Smart Material Logic (Material Service)
**Module:** `js/services/material-service.js`

Connects components to the Piping Class Master for specification verification.

- **Piping Class Extraction:** Parses `Material` or `Spec` fields using the configured token/regex strategy.
- **Attribute Resolution:** Looks up Class + Bore in the master table to retrieve Wall Thickness, Corrosion Allowance, and Material grade.
- **Override Rule:** Master values replace CSV defaults only when the CSV field is blank or zero.

---

## 3. Weight Logic (Weight Service)
**Module:** `js/services/weight-service.js`

Calculates component weight when missing from the source CSV.

### Smart Valve Weight Detection
1. Calculates 3D Euclidean distance between `EP1` and `EP2` of the Valve.
2. Scans `Docs/wtValveweights.xlsx` master table.
3. Matches on `Size` + `Rating` + calculated `Length` (within ±6 mm tolerance).
4. Returns the pattern-specific weight for that valve configuration.
5. **Fallback:** Matches on `Size` + `Class` if length matching fails.

---

## 4. Input Header Processing
**Module:** `js/services/csv-parser.js` + `js/input/header-mapper.js`

Normalizes all incoming CSV headers before any processing step.

- **Sanitization:** Trims whitespace, collapses multiple spaces, strips Unicode BOM, normalizes smart-quotes and em-dashes.
- **Alias Matching:** Checks each header against the full alias dictionary (e.g. `"O.D."`, `"Outside Dia"`, `"OD"` all map to `O/D`).
- **Outcome:** Downstream logic always sees canonical names (`Bore`, `East`, `North`, `RefNo`) regardless of input variation.

Sanitization toggles (all configurable in Config → Input & Parse Settings):

| Toggle | Default | Effect |
|:---|:---:|:---|
| Trim Whitespace | ON | Removes leading/trailing spaces from all cells |
| Strip BOM | ON | Removes UTF-8 BOM from first header |
| Normalize Unicode | ON | Converts smart-quotes and em-dashes to ASCII |
| Collapse Spaces | ON | Collapses multiple spaces in headers to single space |
| Lowercase Headers | OFF | Forces all headers to lowercase before alias matching |

---

## 5. Smart Excel Parsing
**Module:** `js/services/excel-parser.js`

Handles messy Excel imports (Linelist, LineDump) where the header row may not be Row 1.

- **Auto-Detection:** Scans the first **20 rows** for the row with the highest density of expected keywords (e.g. `"Line No"`, `"Service"`, `"Pressure"`).
- **Benefit:** Automatically skips title rows, logo cells, or empty header blocks at the top of the file.

---

## 6. Smart Validator & Fixer
**Module:** `js/editor/components/ValidatorPanel.jsx` (3D Viewer)

Real-time geometry validation accessible from within the **3D Viewer tab**.

- **RUN CHECK:** Scans all components for connectivity gaps, missing endpoints, and bore mismatches.
- **Tolerance:** Configured via the `Tol (mm)` input (default 6 mm).
- **Auto-Fix:** For detected issues, the fixer proposes and applies coordinate corrections directly to the Data Table state.
- **Result:** The corrected state is the single source of truth for the **Export as PCF** button.

---

## 7. Smart 3D Fixer (SmartFixer)
**Module:** `js/editor/smart/SmartFixer.js`

Applies minor automated corrections to the 3D model without requiring manual edits:

- Snaps near-coincident endpoints within a configurable tolerance.
- Detects and flags loop routing errors (circular routes with no branch).
- Highlights missing connections in the Data Table with colour-coding (blue = missing connection, pink = loop error).
