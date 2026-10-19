// ============================================================
// Master MDM Definitions & Canonical Attributes
// ============================================================

export interface CanonicalAttribute {
  name: string;
  key: string;
  type: 'string' | 'number' | 'date' | 'boolean';
  category: 'ID' | 'NAME' | 'EMAIL' | 'PHONE' | 'ADDRESS' | 'DEMOGRAPHIC' | 'OTHER' | 'IDENTIFIER' | 'DESCRIPTOR' | 'TEMPORAL';
  description?: string;
  required?: boolean;
}

export interface MasterDefinition {
  id: string;
  name: string;
  domain: string;
  description: string;
  iconName: string;
  targetCatalog: string;
  targetSchema: string;
  targetTable: string;
  canonicalAttributes: CanonicalAttribute[];
  status?: 'active' | 'processing' | 'inactive' | string;
  fullTarget?: string;
}

export const MASTER_DEFINITIONS: MasterDefinition[] = [
  {
    id: 'customer_mdm',
    name: 'Customer MDM',
    domain: 'customer',
    description: 'Consolidated B2C & B2B Customer 360 Master Data',
    iconName: 'Users',
    targetCatalog: 'mdm',
    targetSchema: 'gold',
    targetTable: 'customer_golden_records',
    canonicalAttributes: [
      { name: 'Customer ID', key: 'record_id', type: 'string', category: 'ID', description: 'Unique source system identifier', required: true },
      { name: 'Name', key: 'name', type: 'string', category: 'NAME', description: 'Consolidated Full Name (first_name, last_name, customer_name)', required: true },
      { name: 'Email', key: 'email', type: 'string', category: 'EMAIL', description: 'Primary email address' },
      { name: 'Phone', key: 'phone', type: 'string', category: 'PHONE', description: 'Normalized phone number' },
      { name: 'Address', key: 'address', type: 'string', category: 'ADDRESS', description: 'Street address' },
      { name: 'City', key: 'city', type: 'string', category: 'DEMOGRAPHIC', description: 'City name' },
      { name: 'State', key: 'state', type: 'string', category: 'DEMOGRAPHIC', description: 'State or province' },
      { name: 'DOB', key: 'dob', type: 'date', category: 'DEMOGRAPHIC', description: 'Date of birth' },
      { name: 'Postal Code', key: 'postal_code', type: 'string', category: 'ADDRESS', description: 'ZIP or postal code' },
      { name: 'Country', key: 'country', type: 'string', category: 'DEMOGRAPHIC', description: 'Country code or name' },
    ],
  },
  {
    id: 'product_mdm',
    name: 'Product MDM',
    domain: 'product',
    description: 'Master Catalog for SKUs, Products & Categories',
    iconName: 'Package',
    targetCatalog: 'mdm',
    targetSchema: 'gold',
    targetTable: 'product_golden_records',
    canonicalAttributes: [
      { name: 'Product ID', key: 'record_id', type: 'string', category: 'ID', description: 'SKU or product identifier', required: true },
      { name: 'Product Name', key: 'product_name', type: 'string', category: 'NAME', description: 'Primary product title', required: true },
      { name: 'Brand', key: 'brand', type: 'string', category: 'OTHER', description: 'Brand or manufacturer' },
      { name: 'Category', key: 'category', type: 'string', category: 'OTHER', description: 'Product category' },
      { name: 'Price', key: 'price', type: 'number', category: 'OTHER', description: 'List price' },
      { name: 'Description', key: 'description', type: 'string', category: 'OTHER', description: 'Product details' },
    ],
  },
  {
    id: 'vendor_mdm',
    name: 'Vendor MDM',
    domain: 'supplier',
    description: 'Master Supplier & Third-Party Vendor Directory',
    iconName: 'Truck',
    targetCatalog: 'mdm',
    targetSchema: 'gold',
    targetTable: 'vendor_golden_records',
    canonicalAttributes: [
      { name: 'Vendor ID', key: 'record_id', type: 'string', category: 'ID', description: 'Vendor account number', required: true },
      { name: 'Vendor Name', key: 'vendor_name', type: 'string', category: 'NAME', description: 'Company or vendor name', required: true },
      { name: 'Tax ID', key: 'tax_id', type: 'string', category: 'ID', description: 'EIN / Tax identification number' },
      { name: 'Email', key: 'email', type: 'string', category: 'EMAIL', description: 'Contact email' },
      { name: 'Phone', key: 'phone', type: 'string', category: 'PHONE', description: 'Contact phone' },
      { name: 'Address', key: 'address', type: 'string', category: 'ADDRESS', description: 'Business address' },
    ],
  },
  {
    id: 'employee_mdm',
    name: 'Employee MDM',
    domain: 'employee',
    description: 'Internal Staff & HR Personnel Master Records',
    iconName: 'UserCheck',
    targetCatalog: 'mdm',
    targetSchema: 'gold',
    targetTable: 'employee_golden_records',
    canonicalAttributes: [
      { name: 'Employee ID', key: 'record_id', type: 'string', category: 'ID', description: 'HR staff identifier', required: true },
      { name: 'Full Name', key: 'employee_name', type: 'string', category: 'NAME', description: 'Employee name', required: true },
      { name: 'Work Email', key: 'email', type: 'string', category: 'EMAIL', description: 'Corporate email' },
      { name: 'Department', key: 'department', type: 'string', category: 'OTHER', description: 'Business unit or team' },
      { name: 'Job Title', key: 'job_title', type: 'string', category: 'OTHER', description: 'Official role title' },
      { name: 'Phone', key: 'phone', type: 'string', category: 'PHONE', description: 'Office or mobile phone' },
    ],
  },
  {
    id: 'location_mdm',
    name: 'Location',
    domain: 'location',
    description: 'Stores, sites, warehouses & geographic locations',
    iconName: 'Building',
    targetCatalog: 'mdm',
    targetSchema: 'gold',
    targetTable: 'location_golden_records',
    canonicalAttributes: [
      { name: 'Location ID', key: 'record_id', type: 'string', category: 'ID', description: 'Site or store identifier', required: true },
      { name: 'Location Name', key: 'location_name', type: 'string', category: 'NAME', description: 'Site or facility name', required: true },
      { name: 'Address', key: 'address', type: 'string', category: 'ADDRESS', description: 'Street address' },
      { name: 'City', key: 'city', type: 'string', category: 'DEMOGRAPHIC', description: 'City name' },
      { name: 'State', key: 'state', type: 'string', category: 'DEMOGRAPHIC', description: 'State or province' },
      { name: 'Postal Code', key: 'postal_code', type: 'string', category: 'ADDRESS', description: 'ZIP or postal code' },
      { name: 'Country', key: 'country', type: 'string', category: 'DEMOGRAPHIC', description: 'Country code or name' },
    ],
  },
];

/**
 * Normalizes an identifier or name for comparison (lowercased, spaces/underscores/hyphens unified)
 */
export function normalizeMdmKey(val?: string): string {
  if (!val) return '';
  return val
    .toLowerCase()
    .trim()
    .replace(/[\s\-_]+/g, '_')
    .replace(/_mdm$/, '');
}

/**
 * Deduplicates and merges MasterDefinition lists so that each domain is strictly unique
 * by ID, Name, or normalized key.
 */
export function mergeAndDeduplicateMdms(
  base: MasterDefinition[] = MASTER_DEFINITIONS,
  custom: MasterDefinition[] = []
): MasterDefinition[] {
  const result: MasterDefinition[] = [];
  const seenKeys = new Set<string>();

  const registerKey = (item: MasterDefinition): string[] => {
    const keys: string[] = [];
    if (item.id) keys.push(normalizeMdmKey(item.id));
    if (item.domain) keys.push(normalizeMdmKey(item.domain));
    if (item.name) keys.push(normalizeMdmKey(item.name));
    return keys;
  };

  // 1. Add base definitions
  for (const item of base) {
    if (!item) continue;
    const keys = registerKey(item);
    keys.forEach(k => seenKeys.add(k));
    result.push({ ...item });
  }

  // 2. Merge custom definitions
  for (const item of custom) {
    if (!item || !item.id) continue;
    const keys = registerKey(item);
    const hasOverlap = keys.some(k => seenKeys.has(k));

    if (hasOverlap) {
      // Find matching item in result to merge attributes without creating duplicate
      const matchIdx = result.findIndex(r => {
        const rKeys = registerKey(r);
        return keys.some(k => rKeys.includes(k));
      });
      if (matchIdx >= 0) {
        if (item.canonicalAttributes && item.canonicalAttributes.length > 0) {
          result[matchIdx] = {
            ...result[matchIdx],
            canonicalAttributes: item.canonicalAttributes,
            ...(item.description ? { description: item.description } : {}),
          };
        }
      }
      continue;
    }

    // New unique custom definition
    keys.forEach(k => seenKeys.add(k));
    result.push({ ...item });
  }

  return result;
}

/**
 * Loads custom MDMs from localStorage, deduplicating both against built-in
 * definitions and within custom entries, automatically fixing corrupted/duplicated state.
 */
export function getCleanCustomMdms(): MasterDefinition[] {
  try {
    const raw = JSON.parse(localStorage.getItem('lf_custom_mdm_targets') || '[]');
    if (!Array.isArray(raw)) return [];

    const baseKeys = new Set<string>();
    for (const b of MASTER_DEFINITIONS) {
      if (b.id) baseKeys.add(normalizeMdmKey(b.id));
      if (b.domain) baseKeys.add(normalizeMdmKey(b.domain));
      if (b.name) baseKeys.add(normalizeMdmKey(b.name));
    }

    const clean: MasterDefinition[] = [];
    const seenCustomKeys = new Set<string>();

    // Process from newest to oldest to preserve the latest customization
    for (let i = raw.length - 1; i >= 0; i--) {
      const item = raw[i];
      if (!item || !item.id) continue;
      const keys = [
        normalizeMdmKey(item.id),
        normalizeMdmKey(item.domain),
        normalizeMdmKey(item.name)
      ].filter(Boolean);

      // Deduplicate so only the most recent customization for a given key is kept
      const duplicatesCustom = keys.some(k => seenCustomKeys.has(k));
      if (duplicatesCustom) continue;

      keys.forEach(k => seenCustomKeys.add(k));
      clean.unshift(item);
    }

    if (clean.length !== raw.length) {
      localStorage.setItem('lf_custom_mdm_targets', JSON.stringify(clean));
      window.dispatchEvent(new CustomEvent('mdm_definitions_changed'));
    }

    return clean;
  } catch {
    return [];
  }
}

