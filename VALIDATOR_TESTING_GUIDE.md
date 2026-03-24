# Smart Validator - Testing Guide

## 🎯 Quick Start Testing

### 1. Open the Application
```
URL: http://localhost:5173
Dev Server: Already running ✅
```

### 2. Navigate to 3D Viewer Tab
1. Click **"3D Viewer"** tab in the navigation
2. You should see the PCF input panel on the left

### 3. Load Test Data
**Option A:** Load from Output
- Go to **Output** tab first
- Generate a PCF
- Return to **3D Viewer** tab
- Click **"Final"** button to load

**Option B:** Paste Test PCF
```
PIPE
END-POINT 0 0 0 100
END-POINT 1000 0 0 100

PIPE
END-POINT 1010 0 0 100
END-POINT 2000 0 0 100

ELBOW
END-POINT 2000 0 0 100
END-POINT 2000 1000 0 100
```

### 4. Generate 3D Model
1. Click **"▶ Generate 3D"** button
2. Wait for 3D visualization to load

### 5. Open Validator Panel
1. Look for **"🔍 Validator"** button in viewer controls
2. Click to toggle the validator panel
3. Panel should slide up from the bottom

### 6. Run Validation
1. Click **"▶ Run Validation"** button
2. Issues should appear in the table
3. Statistics should update at the bottom

---

## 🧪 Feature Testing Checklist

### ✅ UI Tests

#### Panel Display
- [ ] Validator button appears in viewer controls
- [ ] Panel toggles on/off when clicking button
- [ ] Panel is hidden by default
- [ ] Panel doesn't cover 3D canvas when visible
- [ ] Panel resizes correctly with window

#### Issue Table
- [ ] Table displays with correct columns (#, Type, Description, Actions)
- [ ] Issues are color-coded by severity (Red=ERROR, Orange=WARNING)
- [ ] Row highlighting works on hover
- [ ] Scrolling works for many issues

#### Filters
- [ ] ALL button shows all issues
- [ ] ERROR button filters to errors only
- [ ] WARNING button filters to warnings only
- [ ] Counts update correctly

#### Statistics Footer
- [ ] Total count is accurate
- [ ] Auto-fixable count is accurate
- [ ] Error count is accurate
- [ ] Warnings count displays

---

### ✅ Validation Tests

#### Test Case 1: Broken Connection (Small Gap)
**Test Data:**
```javascript
nodes: [
    { id: 'n1', x: 0, y: 0, z: 0, connectedSticks: ['s1'] },
    { id: 'n2', x: 10, y: 0, z: 0, connectedSticks: [] }
]
sticks: [
    { id: 's1', connectedNodes: ['n1'], data: { bore: 100 } }
]
```
**Expected:**
- [ ] Detects 1 BROKEN_CONNECTION issue
- [ ] Gap = 10mm
- [ ] Severity = ERROR
- [ ] Auto-fixable = true
- [ ] Description mentions gap size

#### Test Case 2: Model Error (Large Gap)
**Test Data:**
```javascript
nodes: [
    { id: 'n1', x: 0, y: 0, z: 0, connectedSticks: ['s1'] },
    { id: 'n2', x: 5000, y: 0, z: 0, connectedSticks: [] }
]
```
**Expected:**
- [ ] Detects 1 MODEL_ERROR issue
- [ ] Gap = 5000mm
- [ ] Severity = WARNING
- [ ] Description mentions "Open end"

#### Test Case 3: Overlap
**Test Data:**
```javascript
// Two pipes intersecting
sticks: [
    { id: 's1', connectedNodes: ['n1', 'n2'], data: { bore: 100 } },
    { id: 's2', connectedNodes: ['n3', 'n4'], data: { bore: 100 } }
]
// where segments cross each other
```
**Expected:**
- [ ] Detects 1 OVERLAP issue
- [ ] Severity = ERROR (if bores match)
- [ ] Auto-fixable = true
- [ ] Description shows overlap depth

---

### ✅ Fix Tests

#### Test Fix 1: Snap Nodes
1. Create broken connection with gap < 6mm
2. Click **"▶ Run Validation"**
3. Click **"✓ Fix"** button
4. **Expected:**
   - [ ] Nodes move to midpoint
   - [ ] 3D visualization updates
   - [ ] Issue disappears on re-validation
   - [ ] Success toast appears

#### Test Fix 2: Insert PIPE
1. Create broken connection with gap 100mm
2. Same direction (e.g., both on X axis)
3. Click **"✓ Fix"**
4. **Expected:**
   - [ ] New PIPE component appears
   - [ ] Connects the two nodes
   - [ ] 3D shows new pipe segment
   - [ ] Data table adds new row

#### Test Fix 3: Insert ELBOW
1. Create broken connection with direction change
2. Gap between nodes at 90° angle
3. Click **"✓ Fix"**
4. **Expected:**
   - [ ] New ELBOW node created
   - [ ] Two PIPE segments created
   - [ ] 3D shows elbow + pipes
   - [ ] Data table updated

#### Test Fix 4: Trim Overlap
1. Create overlapping pipes (same bore)
2. Click **"✓ Fix"**
3. **Expected:**
   - [ ] Closest node moves to intersection
   - [ ] Overlap resolved
   - [ ] 3D updates immediately
   - [ ] Issue cleared

---

### ✅ Focus Tests

#### Focus on Issue
1. Run validation
2. Click **"🎯 Focus"** on any issue
3. **Expected:**
   - [ ] Camera smoothly animates to issue location
   - [ ] Issue position is centered in view
   - [ ] Highlight appears on geometry (if implemented)
   - [ ] Animation takes ~1 second

---

### ✅ Integration Tests

#### Data Table Sync
1. Run validation
2. Apply a fix
3. Switch to **"📊 Data Table"** view
4. **Expected:**
   - [ ] Table reflects geometry changes
   - [ ] Modified components marked
   - [ ] Row count updated
   - [ ] Coordinates changed

#### 3D Viewer Sync
1. Apply fix in validator
2. Return to 3D view
3. **Expected:**
   - [ ] 3D geometry updated
   - [ ] New components rendered
   - [ ] Modified components visible
   - [ ] No visual glitches

#### Store State Sync
1. Open browser console
2. Type: `useEditorStore.getState().nodes`
3. Apply a fix
4. Check state again
5. **Expected:**
   - [ ] Nodes array updated
   - [ ] `isModified` flag set
   - [ ] Position changes reflected

---

### ✅ Configuration Tests

#### Change Tolerance
```javascript
// In browser console
import { setConfig } from './js/editor/smart/index.js';
setConfig('tolerance', 10.0);
```
**Expected:**
- [ ] Validation uses new tolerance
- [ ] More/fewer issues detected
- [ ] Auto-fix threshold changed

#### Disable Rules
```javascript
setConfig('brokenConnection.enabled', false);
```
**Expected:**
- [ ] Broken connections not detected
- [ ] Other rules still work

---

### ✅ Error Handling Tests

#### No Data Loaded
1. Open validator without loading PCF
2. Click **"▶ Run Validation"**
3. **Expected:**
   - [ ] Shows "No issues found" message
   - [ ] No errors in console
   - [ ] Panel remains functional

#### Invalid Data
1. Load malformed PCF
2. Generate 3D (may fail)
3. Run validation
4. **Expected:**
   - [ ] Graceful handling
   - [ ] Error logged to console
   - [ ] Panel doesn't crash

#### Fix Failure
1. Create issue that can't be fixed
2. Click **"✓ Fix"**
3. **Expected:**
   - [ ] Error toast appears
   - [ ] Geometry unchanged
   - [ ] Panel remains functional

---

### ✅ Performance Tests

#### Large Dataset (1000+ components)
1. Load large PCF file
2. Generate 3D
3. Run validation
4. **Expected:**
   - [ ] Completes in < 2 seconds
   - [ ] UI remains responsive
   - [ ] No browser freeze
   - [ ] Memory usage reasonable

#### Multiple Validations
1. Run validation 10 times in a row
2. **Expected:**
   - [ ] Consistent performance
   - [ ] No memory leaks
   - [ ] Results identical each time

---

## 🐛 Known Issues / Limitations

### Current Limitations
1. **TEE Detection** - Not yet implemented
2. **OLET Offset** - Not applied in current fix strategies
3. **Multi-plane Analysis** - Only single-plane validation
4. **Undo/Redo** - Not implemented

### Planned Enhancements
- [ ] Add undo/redo functionality
- [ ] Implement TEE-specific logic
- [ ] Add OLET spatial offset
- [ ] Support multi-plane validation
- [ ] Add batch fix option
- [ ] Export validation report

---

## 📊 Test Results Template

```markdown
## Test Session: [Date]
**Tester:** [Name]
**Version:** PCF Converter V5.6b
**Browser:** [Chrome/Firefox/Edge]

### Summary
- Tests Run: __/50
- Passed: __
- Failed: __
- Skipped: __

### Failed Tests
1. [Test Name]: [Reason]
2. [Test Name]: [Reason]

### Notes
[Any observations or suggestions]
```

---

## 🔍 Debugging Tips

### Enable Debug Logging
```javascript
// In browser console
localStorage.setItem('validator_debug', 'true');
```

### Check Store State
```javascript
console.log(useEditorStore.getState());
```

### Inspect Issues
```javascript
// After running validation
window.__VALIDATOR_ISSUES__ = issues;
console.log(window.__VALIDATOR_ISSUES__);
```

### Monitor Performance
```javascript
console.time('validation');
validator.validate(data);
console.timeEnd('validation');
```

---

## ✅ Sign-Off Checklist

Before marking as production-ready:

### Code Quality
- [ ] All tests pass
- [ ] No console errors
- [ ] No performance issues
- [ ] Code reviewed

### Documentation
- [ ] README complete
- [ ] Impact analysis done
- [ ] Testing guide (this file)
- [ ] API documented

### User Experience
- [ ] UI is intuitive
- [ ] Tooltips/help text added
- [ ] Error messages clear
- [ ] Performance acceptable

### Integration
- [ ] Works with existing features
- [ ] No breaking changes
- [ ] Data table syncs
- [ ] 3D viewer updates

---

## 🎉 Test Completion

**Tested By:** ________________
**Date:** ________________
**Result:** ☐ PASS  ☐ FAIL  ☐ PARTIAL

**Ready for Production:** ☐ YES  ☐ NO

**Signature:** ________________
