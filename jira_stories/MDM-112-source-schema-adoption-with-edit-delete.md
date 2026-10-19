# MDM-112: Step 2 Option 2 - Pick Structure from Registered Sources with Edit & Delete

## Status: DONE
**Type**: Feature / Workflow Enhancement  
**Priority**: High  
**Component**: Frontend (`MdmGoldenRecords.tsx`)

---

## 1. Description
In Step 2 (Master Structure), Option 2 allows the user to pick one of the source tables registered in Step 1 to adopt its exact column structure as the starting master schema, followed by full edit and delete capabilities.

### Detailed Requirements:
1. **Source Picker**:
   - Clearly titled "Option 2: Pick from Registered Sources".
   - Shows all tables registered in Step 1 with catalog, schema, table name, and record count.
2. **Schema Adoption**:
   - Clicking "Adopt Schema" extracts the columns of that source table and loads them into the canonical structure.
   - Shows banner: "Adopted schema from `<catalog>.<schema>.<table>`. You can now edit, delete, or add columns below."
3. **Full Column Management**:
   - Displays the canonical columns table for the adopted schema.
   - Every column includes:
     - **Edit Column**: Rename column name, change key, change data type, change category.
     - **Delete Column**: Remove unwanted columns.
   - Ability to add new custom columns to the adopted schema.
4. **Save & Proceed**:
   - "Save Schema & Proceed to Mapping" persists the master structure and navigates to Step 3.

---

## 2. Acceptance Criteria
- [ ] Option 2 displays registered tables with "Adopt Schema" action.
- [ ] Adopting schema loads the source columns and displays the column manager.
- [ ] Users can edit column names and delete any column from the adopted structure.
- [ ] Users can add new columns to the adopted structure.
- [ ] Saving proceeds to Step 3.
