# MDM-111: Step 2 Option 1 - Suggest Master Structure from Selected Tables

## Status: DONE
**Type**: Feature / Workflow Enhancement  
**Priority**: High  
**Component**: Frontend (`MdmGoldenRecords.tsx`)

---

## 1. Description
When the user enters Step 2 (Master Structure), Option 1 must intelligently suggest the structure and column names based on the registered Databricks tables from Step 1.

### Detailed Requirements:
1. **Intelligent Schema Suggestion Engine**:
   - Scan schemas of all tables currently registered in `mdmSources`.
   - Normalize, beautify, and categorize column names (e.g., `cust_id` / `customer_id` -> `Customer ID` [ID], `email_addr` -> `Email Address` [EMAIL], `phone_num` -> `Phone Number` [PHONE], etc.).
   - Automatically deduplicate common columns across multiple tables (e.g., both CRM and ERP have `email` -> consolidated to one canonical `Email` column).
   - Pre-populate the canonical master structure with these suggested columns.
2. **Column Edit & Delete Actions**:
   - Each suggested column in the table has:
     - **Edit Column**: Inline editing of Column Name, Field Key, Data Type, Category, and Required flag.
     - **Delete Column**: 1-click removal of unwanted columns.
   - **Add Custom Column**: Quick form to add any extra canonical columns.
3. **Re-Analyze & Suggest Action**:
   - A prominent button to "Re-Analyze & Suggest from Registered Tables" to re-run schema synthesis whenever needed.
4. **Save & Proceed**:
   - "Save Schema & Proceed to Mapping" saves the canonical structure to the MDM definition and moves to Step 3.

---

## 2. Acceptance Criteria
- [ ] Option 1 is clearly titled "Option 1: Suggest Structure from Selected Tables".
- [ ] Automatically synthesizes column suggestions from all registered source tables.
- [ ] Every column provides inline Edit and Delete options.
- [ ] Users can add new custom columns.
- [ ] Saving proceeds directly to Step 3.
