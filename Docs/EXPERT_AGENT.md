# Expert Agent Personas

To get the best results from an AI agent, explicitly invoke a "Persona" that aligns with your task.

## 1. The "GUI UX Expert"
*   **Keywords**: "Frontend Specialist", "Accessibility", "Responsive Design", "CSS Grid", "Event Delegation".
*   **Scenario**: The user finds the "Mapping Tab" confusing or the buttons are misaligned on small screens.
*   **Ask For**: "Review `js/ui/mapping-tab.js` and `css/app.css`. Suggest a responsive layout using CSS Grid for the mapping table. Provide a code snippet to make the 'Next' button sticky at the bottom."
*   **Prompt**: "Act as a GUI UX Expert. The `MasterDataController` renders a complex tab interface. Refactor the tab switching logic to use ARIA roles for accessibility and ensure the active tab state is visually distinct."

## 2. The "Complex Analysis Expert" (Deep Architect)
*   **Keywords**: "Systems Thinking", "Trade-offs", "Robustness", "Edge Cases", "Algorithm Complexity", "Data Integrity".
*   **Scenario**: The application crashes when processing a PCF with a 140km long pipe (Spider Web issue) or circular references.
*   **Ask For**: "Analyze `js/geometry/pipeline.js` and `overlap-resolver.js`. Identify why the recursion depth limit isn't triggering for circular pipe loops. Propose a robust graph traversal algorithm."
*   **Prompt**: "Act as a Deep Architect. Review the `segmentizePipes` function. It currently runs O(N^2). Propose a spatial indexing solution (like an Octree or Grid) to optimize this for 10,000 components."

## 3. The "Process Flow Expert"
*   **Keywords**: "Pipeline Orchestration", "State Management", "Data Flow", "Dependency Injection", "Asynchronous Operations".
*   **Scenario**: The UI freezes when uploading a 50MB CSV file because parsing is blocking the main thread.
*   **Ask For**: "Trace the data flow from `Input Tab` to `Mapping Service`. Suggest how to offload `PapaParse` to a Web Worker and implement a progress bar."
*   **Prompt**: "Act as a Process Flow Expert. The state management in `js/state.js` is causing race conditions between the `Validator` and the `Viewer`. Design a Pub/Sub event bus to decouple these modules."

## 4. The "Forensic Debugger"
*   **Keywords**: "Root Cause Analysis", "Log Interpretation", "Anomaly Detection".
*   **Scenario**: A specific TEE component is missing from the final PCF output, but no error is shown.
*   **Ask For**: "Examine `js/utils/diagnostic-logger.js`. The log shows 'Gap fill blocked'. Trace this message back to `js/geometry/snapper.js` and explain why the Bore Mismatch tolerance check failed."
*   **Prompt**: "Act as a Forensic Debugger. I have a case where a VALVE is mapped to weight 0.0 KG. Review `js/services/weight-service.js`. Is the 'Size + Description + Length' lookup logic failing? Provide a console snippet to debug the fuzzy matching score."
