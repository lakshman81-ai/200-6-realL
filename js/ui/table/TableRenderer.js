/**
 * TableRenderer.js
 * Handles DOM manipulation, table structure creation, and cell updates.
 */

export class TableRenderer {
    constructor(container, headers) {
        this.container = container;
        this.headers = headers;
        this.tableData = [];
    }

    render(rows, onCellBlur) {
        this.container.innerHTML = "";
        this.tableData = [];

        const mainStruct = this.createTableStruct("pcf-table-main", "1. Pipe & Components (Sequenced)");
        const suppStruct = this.createTableStruct("pcf-table-supports", "2. Supports / Zero-Length Items (Appended)");

        rows.forEach((rowObj, idx) => {
            const tr = document.createElement("tr");
            const rowData = rowObj.data;
            this.tableData.push(rowData);

            // Apply highlighting logic (Missing Connections / Loops)
            const pF = String(rowData[25] || "").trim();
            const nF = String(rowData[26] || "").trim();
            const l1 = parseFloat(rowData[10]) || 0;
            const l2 = parseFloat(rowData[12]) || 0;
            const l3 = parseFloat(rowData[14]) || 0;
            const tL = l1 + l2 + l3;

            const missingP = !pF || pF === "N/A";
            const missingN = !nF || nF === "N/A";
            const localLoop = (tL >= 0.1) && (pF === nF) && (!missingP && !missingN);

            let rowStyleClass = "";
            if (!rowObj.isPoint) {
                if (localLoop) rowStyleClass = "row-loop-error";
                else if (missingP || missingN) rowStyleClass = "row-missing-conn";
            }

            rowData.forEach((val, colIdx) => {
                const td = document.createElement("td");
                td.textContent = val;
                td.dataset.row = idx;
                td.dataset.col = colIdx;
                td.spellcheck = false;

                if (colIdx >= 23 || colIdx === 0) {
                    td.contentEditable = "true";
                } else {
                    td.contentEditable = "false";
                    td.classList.add("locked-cell");
                }

                if (colIdx === 27 && val) td.classList.add("text-success"); // Line No (Derived)
                if (colIdx >= 19 && colIdx <= 22) td.classList.add("smart-cell");

                if (rowStyleClass === "row-loop-error") td.classList.add("bg-pink-error");
                else if (rowStyleClass === "row-missing-conn") td.classList.add("bg-blue-light");

                td.addEventListener("blur", (e) => {
                    const newVal = e.target.textContent.trim();
                    if (newVal !== String(val)) {
                        onCellBlur(idx, colIdx, newVal);
                        e.target.classList.add("cell-edited");
                    }
                });

                tr.appendChild(td);
            });

            if (rowObj.isPoint) suppStruct.tbody.appendChild(tr);
            else mainStruct.tbody.appendChild(tr);
        });

        this.container.appendChild(mainStruct.wrap);
        if (suppStruct.tbody.children.length > 0) {
            this.container.appendChild(suppStruct.wrap);
        }

        // ─ Fill-Down click handler (delegated) ───────────────────────────────
        this.container.addEventListener('click', (e) => {
            const btn = e.target.closest('.fill-down-btn');
            if (!btn) return;
            e.stopPropagation();

            const colName = btn.dataset.col;
            const COL_IDX = this.headers.indexOf(colName);
            if (COL_IDX < 0) return;

            const tbl = btn.closest('table');
            if (!tbl) return;

            const allRows = Array.from(tbl.querySelectorAll('tbody tr'));

            const focusedTd = tbl.querySelector(`td[data-col="${COL_IDX}"]:focus, td[data-col="${COL_IDX}"].cell-edited`);
            const sourceTd = focusedTd || allRows.reduce((found, tr) => {
                if (found) return found;
                const td = tr.querySelector(`td[data-col="${COL_IDX}"]`);
                return (td && td.textContent.trim()) ? td : null;
            }, null);

            if (!sourceTd) { alert(`No ${colName} value found to fill down from.`); return; }

            const sourceVal = sourceTd.textContent.trim();
            const sourceRowIdx = parseInt(sourceTd.dataset.row, 10);

            let filled = 0;
            for (let tr of allRows) {
                const td = tr.querySelector(`td[data-col="${COL_IDX}"]`);
                if (!td) continue;
                const rowIdx = parseInt(td.dataset.row, 10);
                if (rowIdx <= sourceRowIdx) continue;   // only rows below the source
                if (td.textContent.trim()) continue;    // skip non-empty cells, do not stop

                td.textContent = sourceVal;
                td.classList.add('cell-edited', 'fill-down-applied');
                onCellBlur(rowIdx, COL_IDX, sourceVal);
                filled++;
            }

            console.log(`[FillDown] Filled ${filled} cells below row ${sourceRowIdx} with "${sourceVal}"`);
        }, { capture: false });

        this.injectStyles();
    }


    createTableStruct(id, title) {
        const wrap = document.createElement("div");
        wrap.className = "table-section";
        wrap.innerHTML = `<h3>${title}</h3>`;

        const tbl = document.createElement("table");
        tbl.className = "data-table editable-table";
        tbl.id = id;

        const thead = document.createElement("thead");
        const trTop = document.createElement("tr");
        const trSub = document.createElement("tr");

        // Base Columns (0-13)
        for (let i = 0; i <= 13; i++) {
            const th = document.createElement("th");
            th.rowSpan = 2;
            th.textContent = this.headers[i];
            trTop.appendChild(th);
        }

        // Group 1: SeqNo Logic (14-17)
        this.addHeaderGroup(trTop, trSub, "SeqNo Logic", 14, 18);

        // Group 2: Smart Logic (18-21)
        this.addHeaderGroup(trTop, trSub, "Smart Logic", 18, 22);

        // Group 3: Final Route (22-25) - 4 Columns
        this.addHeaderGroup(trTop, trSub, "Final Route", 22, 26);

        // Remaining (26+) — Certain columns get a ▼ fill-down button in their header
        const fillDownCols = ['Line No. (Derived)', 'Material (ATTR3)', 'Wall Thk (ATTR4)', 'Piping Class'];
        for (let i = 26; i < this.headers.length; i++) {
            const th = document.createElement("th");
            th.rowSpan = 2;
            if (fillDownCols.includes(this.headers[i])) {
                th.innerHTML = `
                    <span style="display:block;white-space:nowrap">${this.headers[i]}</span>
                    <button
                        class="fill-down-btn"
                        data-col="${this.headers[i]}"
                        title="Fill-Down: copies the focused/first non-empty value downward into blank cells"
                        style="margin-top:3px;cursor:pointer;background:var(--amber);color:#000;border:none;
                               border-radius:3px;padding:1px 5px;font-size:0.7rem;font-weight:700;
                               line-height:1.4;transition:opacity .15s"
                        onmouseover="this.style.opacity='0.75'"
                        onmouseout="this.style.opacity='1'"
                    >&#9660; Fill Down</button>
                `;
            } else {
                th.textContent = this.headers[i];
            }
            trTop.appendChild(th);
        }

        thead.appendChild(trTop);
        thead.appendChild(trSub);
        tbl.appendChild(thead);
        const tbody = document.createElement("tbody");
        tbl.appendChild(tbody);

        wrap.appendChild(tbl);
        return { wrap, tbody };
    }

    addHeaderGroup(trTop, trSub, title, startIdx, endIdx) {
        const th = document.createElement("th");
        th.colSpan = endIdx - startIdx;
        th.textContent = title;
        th.className = "header-group";
        trTop.appendChild(th);

        for (let i = startIdx; i < endIdx; i++) {
            const subTh = document.createElement("th");
            subTh.textContent = this.headers[i];
            trSub.appendChild(subTh);
        }
    }

    injectStyles() {
        if (document.getElementById("pcf-table-styles")) return;
        const style = document.createElement("style");
        style.id = "pcf-table-styles";
        style.textContent = `
            .editable-table td { min-width: 50px; white-space: nowrap; max-width: 300px; overflow: hidden; text-overflow: ellipsis; padding: 4px 8px; font-size: 0.8rem; border-right: 1px solid var(--border-color); }
            .editable-table th { white-space: nowrap; padding: 8px; background: var(--bg-2); position: sticky; top: 0; z-index: 10; font-size: 0.75rem; }
            .header-group { text-align: center; background: var(--bg-4) !important; color: var(--text-secondary); }
            .locked-cell { background: var(--bg-subtle); color: var(--text-muted); cursor: default; }
            .smart-cell { background: var(--bg-3); color: var(--text-muted); }
            .text-success { color: var(--green-ok); font-weight: 600; }
            .bg-pink-error { background-color: rgba(255, 99, 71, 0.2) !important; }
            .bg-blue-light { background-color: rgba(135, 206, 250, 0.2) !important; }
            .cell-edited { border-bottom: 2px solid var(--amber) !important; }
            .fill-down-applied { background-color: rgba(245, 158, 11, 0.12) !important; }
            .table-section h3 { font-size: 1rem; color: var(--text-primary); margin-bottom: 0.5rem; border-bottom: 2px solid var(--steel); padding-bottom: 4px; }
        `;
        document.head.appendChild(style);
    }
}
