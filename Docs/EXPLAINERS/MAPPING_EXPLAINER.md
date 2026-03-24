# Master Data Mapping Explained — PCF Converter V5.1b

The **Master Data** tab allows you to enrich CSV input data with external reference documents: Line Lists, Weight Reports, and Piping Class Masters.

---

## 1. Data Sources

### Linelist (LL)
- **Key field:** `Line Number` — matched against the pipeline reference extracted from `RefNo`.
- **Populates:** Design Pressure (CA1), Design Temperature (CA2), Insulation Thickness (CA5), Fluid Density (CA9), and Service annotations.
- **Logic:**
  1. Parses `RefNo` using the configured token/regex strategy (Config → Smart Data → Line No Logic).
  2. Looks up the extracted Line ID in the Linelist.
  3. Overwrites CSV defaults with Linelist values where available.

### Weight Report
- **Key:** `Size` + `Rating` + `Length` (primary) OR `Size` + `Description` + `Length` (secondary).
- **Populates:** Component Weight (CA8) for Valves and Flanges.
- **Logic:**
  1. Calculates 3D Euclidean length between `EP1` and `EP2` of the component.
  2. Scans `Docs/wtValveweights.xlsx` master table.
  3. Matches on Bore + Rating + Length within ±6 mm tolerance.
  4. Updates CA8 only if the CSV weight is 0 or missing.

### Piping Class Master
- **Key:** `Piping Class` + `Size`.
- **Populates:** Wall Thickness (CA4), Corrosion Allowance (CA7), Material (CA3).
- **Logic:** Extracts spec code from the component, looks up class + size in master, flags anomalies if CSV value differs significantly.

---

## 2. PCF Attribute Mapping (CA Slots)

ISOGEN PCF uses numbered `COMPONENT-ATTRIBUTE` fields (1–10). The converter maps them as follows:

| CA Slot | Label | Primary Source | Fallback |
|:---|:---|:---|:---|
| **CA1** | Design Pressure | CSV `Pressure` | Linelist → Default 700 KPA |
| **CA2** | Design Temperature | CSV `Temperature` | Linelist `Design Temp` → Default 120 C |
| **CA3** | Material | CSV `Material` | Piping Class Master → Default A106-B |
| **CA4** | Wall Thickness | CSV `Wall Thk` | Piping Class Master → Default 9.53 MM |
| **CA5** | Insulation Thickness | CSV `Insulation` | Linelist → Default 0 MM |
| **CA6** | Insulation Density | CSV `Insulation Density` | Default 210 KG/M3 |
| **CA7** | Corrosion Allowance | CSV `Corrosion` | Piping Class Master → Default 3 MM |
| **CA8** | Component Weight | CSV `Weight` | Weight Report → Default 100 KG (Valves/Flanges only) |
| **CA9** | Fluid Density | CSV `Fluid Density` / Phase | Linelist → Default 1000 KG/M3 |
| **CA10** | Hydro Test Pressure | CSV `Hydro Pressure` | Calculated as 1.5 × CA1 → Default 1500 KPA |

> CA8 is only written for FLANGE, VALVE, REDUCER-CONCENTRIC, REDUCER-ECCENTRIC components.

---

## 3. MESSAGE-SQUARE Injection (V5.1b)

Every component block in the generated PCF is preceded by a `MESSAGE-SQUARE` comment line. This line contains:

```
MESSAGE-SQUARE
    {ComponentDesc}, {Material}, LENGTH={L}MM, {Direction}, RefNo:={RefNo}, SeqNo:{SeqNo}
```

- `RefNo` is the raw CSV identifier (e.g. `67130482/1664`). Any leading `=` in the stored value is automatically stripped to avoid double `==` in output.
- `SeqNo` is the CSV row sequence number injected from the sequencer.
- Templates are configurable per component type in **Config → msgTemplates**.

---

## 4. Header Aliases (Config Tab)

Custom header names in your CSV can be mapped to canonical fields in **Config → Header Aliases**.

- *Example:* Map `"Oper Press"`, `"Design P (kPa)"`, or `"P1"` → all resolve to `Pressure` → populates CA1.
- Aliases are case-insensitive and support partial/substring matching.

---

## 5. RefNo & CSV Seq No (PCF Table Form / Data Table)

Two special columns appear in both the **Data Table** (3D Viewer) and the **PCF Table Form** tab:

| Column | Source |
|:---|:---|
| **CSV Seq No** | Read from adjacent `MESSAGE-SQUARE` block's `SeqNo:=` attribute first; falls back to the CSV row's `Seq No.` field; final fallback: `N/A` |
| **Ref No.** | Read from adjacent `MESSAGE-SQUARE` block's `RefNo:=` attribute; scanned backward up to 20 rows from the current component |
