import sys, re
try:
    with open('c:/Code/PCF-converter-App/js/ui/table/TableDataBuilder.js', 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    
    pattern = r'const geoLineNo.*?;[\s\n]*DumpData, dumpCoordTolerance\);\s*const finalLineNo = geoLineNo \|\| \"\";'
    
    replacement = '''const geoLineNo = this.matchLineDump({ x: parseFloat(startX), y: parseFloat(startY), z: parseFloat(startZ), refNo: refNo }, lineDumpData, dumpCoordTolerance);
            const parsedLineNo = firstRow["Line No.(Derived)"] || firstRow["Line Number"] || firstRow["Line No"] || firstRow["Line"] || firstRow["Pipeline Ref"] || "";
            const attrLineNo = (group.attributes || {})["PIPELINE-REFERENCE"] || (group.attributes || {})["COMPONENT-ATTRIBUTE99"] || "";
            const finalLineNo = geoLineNo || parsedLineNo || attrLineNo || "";'''

    new_content = re.sub(pattern, replacement, content, flags=re.DOTALL)
    
    with open('c:/Code/PCF-converter-App/js/ui/table/TableDataBuilder.js', 'w', encoding='utf-8') as f:
        f.write(new_content)
        
    print('Repaired successfully!')
except Exception as e:
    print('ERROR:', e)
