# MDM-110: Reorder MDM Onboarding Flow (Step 1: Source Ingestion, Step 2: Master Schema)

## Status: DONE
**Type**: Improvement / Workflow Restructure  
**Priority**: High  
**Component**: Frontend (`MdmGoldenRecords.tsx`, `MasterDataHub.tsx`, `Sidebar.tsx`)

---

## 1. Description
Restructure the 4-step MDM onboarding and consolidation pipeline so that:
- **Step 1 is Source Table Selection & Registration**: When a user selects or creates an MDM, the initial step is browsing Databricks Unity Catalog / SQL Warehouse and registering source tables.
- **Step 2 is Master Schema Definition**: Once tables are registered, the user defines the master golden record canonical structure with two distinct options:
  - **Option A**: Manual Column Builder (define custom canonical columns).
  - **Option B**: Inherit / Infer directly from the registered Databricks tables (from Step 1).
- **Step 3 remains Source Data Inspection & Schema Mapping**: Inspect live connected source table data and map columns to the master schema.
- **Step 4 remains Golden Records**: View consolidated golden records, confidence scores, and source lineage.

### Requirements:
1. Reorder the `STEPS` array:
   - Step 1: `sources` (Source Tables)
   - Step 2: `schema` (Master Schema)
   - Step 3: `mapping` (Analysis & Mapping)
   - Step 4: `golden` (Golden Records)
2. Update step titles, badges, and breadcrumb indicators ("STEP 1 OF 4", "STEP 2 OF 4", etc.).
3. Update default step on entry to `sources` (`?step=sources`).
4. In Step 1: After table registration, primary action directs user to **Step 2: Master Schema Definition** (`Continue to Master Schema Definition →`).
5. In Step 2: Option B immediately lists all tables registered in Step 1 with 1-click schema adoption. Saving schema transitions user to **Step 3: Analysis & Mapping** (`Save Schema & Proceed to Mapping →`).
6. Add intuitive back/forward navigation between all 4 steps.

---

## 2. Acceptance Criteria
- [x] MDM page opens by default to Step 1: Source Tables Registration.
- [x] Step 1 allows registering Databricks tables and navigating to Step 2: Master Schema.
- [x] Step 2 provides Option A (Manual Builder) and Option B (Inherit from registered tables from Step 1).
- [x] Saving schema in Step 2 transitions smoothly to Step 3: Analysis & Mapping.
- [x] Step 3 mapping verification unlocks Step 4: Golden Records.
- [x] Stepper bar properly reflects: 1. Source Tables -> 2. Master Schema -> 3. Analysis & Mapping -> 4. Golden Records.
