# MDM-107: Golden Records Confidence Percentage & Contributing Source Name Display

## Status: DONE
**Type**: Bug / Fix  
**Priority**: High  
**Component**: Frontend (`MdmGoldenRecords.tsx`, `masterDataService.ts`, `ExcelView`)

---

## 1. Description
1. In the Golden Records page (Step 4), the confidence score is improperly displayed as multi-thousand percent (e.g. `8780%`, `8860%`, `8940%`) due to multiplying an already scaled (0-100) confidence value by 100.
2. Clicking "View Sources" does not display the contributing source system name properly (or drawer is missing / source names are omitted).

### Requirements:
1. Fix Confidence Score calculation and formatting:
   - Values `> 1` (e.g. 87.8) should be rounded directly: `88%` or `87.8%`.
   - Values `<= 1` (e.g. 0.878) should be multiplied by 100: `Math.round(val * 100)%`.
   - Never display values exceeding 100%.
2. Implement expandable "View Sources" details panel under each golden record row:
   - When user clicks "View Sources", expand an informative details drawer beneath the row.
   - Prominently display each Contributing Source System's **Source Name** (e.g., `web_leads_test (mdm.bronze)`, `banking_customers (mdm.bronze)`, `creditcard_customers (mdm.bronze)`).
   - Display the source record ID, match score/trust score, contributing attributes, and values for this golden record.
   - Include a clean "Hide" button to collapse the drawer.

---

## 2. Acceptance Criteria
- [x] Golden Record confidence score displays correctly (e.g. `88%`, `90%`, not `8860%`).
- [x] Clicking "View Sources" toggles an expandable source breakdown drawer.
- [x] The source system name is clearly and prominently displayed with badges and icons for each contributing record.
