# MDM-105: Mapping Verification & Dedicated Save Mapping Flow

## Status: DONE
**Type**: Task / Improvement  
**Priority**: High  
**Component**: Frontend (MdmGoldenRecords.tsx / Step 2 & Step 3)

---

## 1. Description
Currently in Step 3 (Source Analysis & Mapping), after inspecting and mapping columns, the primary action button says "Save Mapping & Generate Golden Records", which prematurely triggers golden record generation even when other registered source tables have not been mapped or verified.

### Requirements:
1. In Step 3, the action button must ONLY be **"Save Mapping"** (not "Save Mapping & Generate Golden Records").
2. Saving the mapping must:
   - Persist the column mappings for the selected source table in `lf_source_systems`.
   - Mark the table mapping status as `VERIFIED` / `MAPPED`.
   - Show a success alert ("Mapping saved and verified for <Source Name>").
   - Offer quick navigation back to Step 2 ("Return to Registered Tables") or switch to the next unmapped table.
3. In Step 2 (Registered Source Tables):
   - Display a status column showing mapping progress per table (`Mapped ✓` vs `Needs Mapping`).
   - The **"Generate Golden Records"** button must only become available/active once ALL registered tables have verified mappings (or with clear indicator of how many remain).
4. Once all mappings are verified, allow generating golden records either from Step 2 header or directly from Step 3.

---

## 2. Acceptance Criteria
- [x] No "Save & Generate Golden Records" button in Step 3 before all sources are mapped.
- [x] Step 3 has a dedicated "Save Mapping" button.
- [x] Step 2 displays mapping progress badges for each registered table.
- [x] "Generate Golden Records" button is only displayed / unlocked once all registered source tables are verified.
