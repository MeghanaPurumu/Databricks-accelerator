# MDM-114: Streamline Step 1 - Remove Redundant Registered Source Tables Card

## Status: DONE
**Type**: UI / Workflow Optimization  
**Priority**: High  
**Component**: Frontend (`MdmGoldenRecords.tsx`)

---

## 1. Description
In Step 1 (Source Table Registration), a secondary card previously displayed "Registered Source Tables" with mapping verification statuses, "Edit Mapping" links, and golden records generation triggers. 

Because:
1. Step 1's single responsibility is browsing Databricks catalogs and schemas and registering tables.
2. Source table inspection, profiling, and schema mapping are comprehensively handled in **Step 3: Analysis & Mapping**.
3. Source adoption is handled in **Step 2: Master Schema Structure**.
4. Golden records generation belongs to **Step 3/4**.

Displaying the redundant table list in Step 1 was cluttering the page and violating the logical linear flow.

### Changes:
- Removed the redundant `Registered Source Tables` table and mapping actions from Step 1.
- Streamlined the Step 1 card action footer to provide:
  - "Back to MDM Data Hub"
  - "Continue to Master Schema Definition &rarr;" (when tables are registered)
  - "Register Selected Tables" button
- All mapping, analysis, and source viewing remain unified in Step 3 and Step 2.

---

## 2. Acceptance Criteria
- [x] Step 1 contains only the clean Databricks table discovery and registration UI.
- [x] Redundant "Registered Source Tables" table is removed from Step 1.
- [x] Users can seamlessly register tables and click "Continue to Master Schema Definition".
- [x] Step 3 continues to handle source table selection, live profiling, and schema mapping.
