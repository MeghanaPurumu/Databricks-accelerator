# MDM-113: Step 3 Schema Mapping, Live Analysis & Master Column Management (Edit & Delete)

## Status: DONE
**Type**: Feature / Workflow Enhancement  
**Priority**: High  
**Component**: Frontend (`MdmGoldenRecords.tsx`)

---

## 1. Description
In Step 3 (Analysis & Schema Mapping), user profiles live Databricks table data, maps registered table columns to defined master structure, and saves mappings. As explicitly requested by the user, Step 3 must also provide the option to **edit and delete column names** directly without losing mapping state.

### Detailed Requirements:
1. **Live Source Profiling & Analysis**:
   - Live row count from Databricks SQL Warehouse.
   - Dynamic Data Quality % and Null Rate %.
   - Live sample source records preview.
2. **Schema Mapping & Save**:
   - Source Column -> Maps To -> Master Target Attribute dropdown.
   - Auto-Map action with heuristic matching.
   - Dedicated "Save Mapping" button that saves the mapping for the active table and marks it verified.
3. **Master Structure Columns Management in Step 3 (Edit & Delete)**:
   - Provide an expandable or embedded "Master Structure Columns" panel right inside Step 3.
   - Users can:
     - **Edit Column Name**: Change the master column display name, key, or type.
     - **Delete Column**: Remove obsolete or erroneous master columns.
     - **Add New Column**: Add a missing canonical column directly from Step 3.
   - Changes immediately synchronize with `customColumns`, `mdmDef.canonicalAttributes`, and dynamically refresh all "Target Attribute" dropdown options in the mapping table without page reload or loss of unsaved mapping work.
4. **Golden Records Unlocking**:
   - Once all registered tables have verified mappings, display the "Generate Golden Records" action.

---

## 2. Acceptance Criteria
- [ ] Step 3 displays live source analysis and sample preview from Databricks.
- [ ] Users can edit and delete canonical master column names directly within Step 3.
- [ ] Editing or deleting a column immediately updates the Target Attribute mapping dropdowns.
- [ ] Save Mapping saves the verified mapping for each table.
- [ ] Golden Records generation is unlocked once all tables are mapped.
