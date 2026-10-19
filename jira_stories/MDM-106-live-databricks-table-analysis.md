# MDM-106: Live Databricks Connected Tables Analysis in Step 3

## Status: DONE
**Type**: Bug / Feature  
**Priority**: High  
**Component**: Backend (`api_server.py`) & Frontend (`MdmGoldenRecords.tsx`, `databricksApiService.ts`)

---

## 1. Description
In Step 3 (Source Analysis & Mapping), data inspection currently displays mock/dummy values (e.g., "Valid", "Active", "Verified" for phone, city, state) instead of real rows from the connected Databricks table. Additionally, `api_server.py` lacked live SQL endpoints for table data, column schema inspection, and row counting.

### Requirements:
1. Update `api_server.py` to support:
   - `GET /api/databricks/table-data`: Execute `SELECT * FROM <catalog>.<schema>.<table> LIMIT <limit>` via Databricks SQL Warehouse if active, returning real column names and live record rows.
   - `GET /api/databricks/table-count`: Execute `SELECT COUNT(*) FROM <catalog>.<schema>.<table>` via SQL Warehouse for exact live row count.
   - `GET /api/databricks/columns` & `/api/mdm/source-preview`: Execute `DESCRIBE TABLE <catalog>.<schema>.<table>` for true live column definitions.
2. In `MdmGoldenRecords.tsx`:
   - Fetch live table data using `fetchTableData(source.catalog, source.schema, source.tableName, 20)`.
   - Remove dummy placeholder values ("Valid", "Active", "Verified").
   - Populate table preview with actual returned records and columns.
   - Dynamically compute Data Quality % and Null Rate % based on the actual live rows.
   - Fetch exact row count using `fetchTableCount` to reflect live Databricks stats.

---

## 2. Acceptance Criteria
- [x] Step 3 queries live table data from Databricks API / SQL Warehouse.
- [x] No placeholder words ("Valid", "Active", "Verified") in the live source preview table.
- [x] Real schema columns and live record rows render accurately in the preview.
- [x] Row count, Null Rate, and Data Quality KPI cards reflect real values.
