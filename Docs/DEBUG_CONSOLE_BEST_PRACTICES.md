# Debug Console & Error Logging Best Practices

## 1. Philosophy: "No Silent Failures"
*   **Visibility**: Errors should surface in the UI, not just `console.error`.
*   **Context**: Logs must include `RefNo`, `Type`, and `Coordinate` context.

## 2. Implementing a Usable Debug Console
For this app, the "Log Tab" or "Status Bar" is the primary debug interface.

### Features to Add
1.  **Structured Object Inspection**: Instead of `[object Object]`, logs should allow expanding details (JSON view).
2.  **Filter by Severity**: Toggle `INFO`, `WARN`, `ERROR`.
3.  **Filter by Component**: Search logs by `RefNo` to see the entire lifecycle of a component (Parse -> Map -> Group -> Snap -> Output).

### Logic Traps to Monitor
*   **Unused Config**:
    *   *Check*: At startup, validate that every key in `DEFAULT_CONFIG` is accessed at least once? (Hard to implement dynamic checks).
    *   *Better*: Use TypeScript or Schema Validation (Zod) to ensure Config matches Code expectations.
*   **Orphan Variables**: Use ESLint `no-unused-vars` (already standard).
*   **Wrongly Assigned Logic**: Use **Unit Tests** for core functions (`snapper.js`, `overlap-resolver.js`).

## 3. Code Instrumentation (Gate Logger)
The `gate-logger.js` is a good start. Enhance it with:
*   **Tags**: `#geometry`, `#mapping`, `#io`.
*   **Performance Metrics**: `TimeTaken` for each step.

## 4. Debugging Workflow
1.  **Symptom**: "Pipe is missing."
2.  **Action**: Search Log for `RefNo`.
3.  **Check**:
    *   Did it parse? (Input Log)
    *   Did it group? (Grouper Log)
    *   Was it skipped? (Dispatcher Log "No writer...")
    *   Was it absorbed? (Overlap Log "Absorbing GASK...")
    *   Was it trimmed? (Snapper Log "Gap fill blocked...")
