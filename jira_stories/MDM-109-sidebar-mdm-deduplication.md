# MDM-109: Master Domain Sidebar Deduplication & State Sanitation

## Status: DONE
**Type**: Bug / Fix  
**Priority**: Medium  
**Component**: Frontend (`Sidebar.tsx`, `mdmMaster.ts`, `MasterDataHub.tsx`, `MdmGoldenRecords.tsx`)

---

## 1. Description
"Customer MDM" and "Location" were appearing twice in the left navigation sidebar under the "Master Data" menu.

### Root Cause:
1. `Sidebar.tsx` was combining built-in `MASTER_DEFINITIONS` with custom domains from localStorage (`lf_custom_mdm_targets`) using a simple array spread: `[...MASTER_DEFINITIONS, ...customMdms]`.
2. When custom MDMs were created or saved with the same names or domain identifiers (e.g. `customer_mdm` / `Customer MDM` or `location_mdm` / `Location`), or duplicated entries in localStorage, `Sidebar.tsx` rendered them multiple times without checking for duplicates.
3. `MasterDataHub.tsx` allowed creating custom MDMs without validating whether an MDM with the same normalized name/domain key already existed.

### Solution:
1. Added `normalizeMdmKey`, `mergeAndDeduplicateMdms`, and `getCleanCustomMdms` in `src/types/mdmMaster.ts`.
2. Cleaned and deduplicated MDM lists by normalizing names, IDs, and domains:
   - Built-in definitions are prioritized.
   - Any custom definition duplicating an existing domain (by name or ID) is merged or filtered out.
   - Automatic sanitation routine strips duplicate items from `localStorage.getItem('lf_custom_mdm_targets')`.
3. Updated `Sidebar.tsx` to use `mergeAndDeduplicateMdms` within a memoized selector, guaranteeing single canonical rendering per domain.
4. Added validation in `MasterDataHub.tsx` (`handleCreateNewMdm`) to block creation of duplicate master domains.

---

## 2. Acceptance Criteria
- [x] "Customer MDM" appears only once in the left navigation sidebar.
- [x] "Location" appears only once in the left navigation sidebar.
- [x] Corrupted or duplicated localStorage entries are automatically sanitized on load.
- [x] Attempting to create an MDM with an existing name displays a validation error.
