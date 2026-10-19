import { QualityMetric, DomainQuality, QualityException, BusinessRule } from '../types';

export interface QualityService {
  getQualityMetrics(): Promise<QualityMetric[]>;
  getDomainQualityMetrics(): Promise<DomainQuality[]>;
  getExceptions(params?: { domain?: string; severity?: string; status?: string }): Promise<QualityException[]>;
  getException(id: string): Promise<QualityException | null>;
  resolveException(id: string, notes: string): Promise<boolean>;
  assignException(id: string, stewardName: string): Promise<boolean>;
  getRules(domain?: string): Promise<BusinessRule[]>;
  createRule(rule: Omit<BusinessRule, 'id' | 'createdBy' | 'lastUpdated'>): Promise<BusinessRule>;
  toggleRuleStatus(id: string): Promise<BusinessRule | null>;
  deleteRule(id: string): Promise<boolean>;
}

// ----------------------------------------------------------------------------
// Realistic Mock Data
// ----------------------------------------------------------------------------

const mockMetrics: QualityMetric[] = [
  { name: 'Completeness', score: 98.2, description: 'Percentage of populated required attributes.', trend: 'up' },
  { name: 'Accuracy', score: 95.7, description: 'Correctness of attributes against authoritative source definitions.', trend: 'stable' },
  { name: 'Consistency', score: 94.1, description: 'Equivalence of duplicate representations across multiple source systems.', trend: 'down' },
  { name: 'Uniqueness', score: 97.5, description: 'Absence of duplicate master record representations.', trend: 'up' },
  { name: 'Validity', score: 96.8, description: 'Conformance of values to standard domain constraints and formats.', trend: 'stable' },
  { name: 'Timeliness', score: 95.2, description: 'Currency of attributes relative to system sync latency expectations.', trend: 'up' }
];

const mockDomainMetrics: DomainQuality[] = [
  {
    domain: 'Customers',
    overallScore: 96.4,
    completeness: 97.5,
    accuracy: 95.8,
    consistency: 93.9,
    uniqueness: 96.1,
    validity: 97.2,
    timeliness: 98.0
  }
];

let mockExceptions: QualityException[] = [
  {
    id: 'EXC-001',
    recordId: 'CUST-002',
    recordName: 'Jon Smith',
    domain: 'customer',
    ruleName: 'US_ZIPCODE_FORMAT',
    severity: 'warning',
    currentValue: '94080-33',
    expectedValue: '5-digit (xxxxx) or ZIP+4 (xxxxx-xxxx) format',
    status: 'open',
    assignedSteward: 'Jane Doe',
    created: '2026-08-19 11:22:15'
  },
  {
    id: 'EXC-002',
    recordId: 'CUST-006',
    recordName: 'Sarah Connor',
    domain: 'customer',
    ruleName: 'EMAIL_VALIDATION',
    severity: 'critical',
    currentValue: 'sconnor@cyberdyne@org',
    expectedValue: 'Standard email format (user@domain.com)',
    status: 'open',
    assignedSteward: 'Unassigned',
    created: '2026-08-19 13:02:11'
  }
];

let mockRules: BusinessRule[] = [
  {
    id: 'RUL-001',
    ruleName: 'EMAIL_VALIDATION',
    domain: 'customer',
    attribute: 'email',
    condition: 'MATCHES ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$',
    severity: 'critical',
    status: 'active',
    createdBy: 'System Administrator',
    lastUpdated: '2026-08-01 09:00:00'
  },
  {
    id: 'RUL-002',
    ruleName: 'US_ZIPCODE_FORMAT',
    domain: 'customer',
    attribute: 'zipCode',
    condition: 'MATCHES ^\\d{5}(-\\d{4})?$',
    severity: 'warning',
    status: 'active',
    createdBy: 'Jane Doe',
    lastUpdated: '2026-08-10 14:30:00'
  }
];

// ----------------------------------------------------------------------------
// QualityService Mock Implementation
// ----------------------------------------------------------------------------

export const mockQualityService: QualityService = {
  getQualityMetrics: async () => {
    return new Promise((resolve) => {
      setTimeout(() => resolve(mockMetrics), 300);
    });
  },

  getDomainQualityMetrics: async () => {
    return new Promise((resolve) => {
      setTimeout(() => resolve(mockDomainMetrics), 300);
    });
  },

  getExceptions: async (params) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        let filtered = [...mockExceptions];
        if (params?.domain) {
          filtered = filtered.filter((e) => e.domain === params.domain);
        }
        if (params?.severity) {
          filtered = filtered.filter((e) => e.severity === params.severity);
        }
        if (params?.status) {
          filtered = filtered.filter((e) => e.status === params.status);
        }
        resolve(filtered);
      }, 400);
    });
  },

  getException: async (id) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const found = mockExceptions.find((e) => e.id === id) || null;
        resolve(found);
      }, 200);
    });
  },

  resolveException: async (id, notes) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const found = mockExceptions.find((e) => e.id === id);
        if (found) {
          found.status = 'resolved';
          resolve(true);
        } else {
          resolve(false);
        }
      }, 400);
    });
  },

  assignException: async (id, stewardName) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const found = mockExceptions.find((e) => e.id === id);
        if (found) {
          found.assignedSteward = stewardName;
          resolve(true);
        } else {
          resolve(false);
        }
      }, 300);
    });
  },

  getRules: async (domain) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        if (domain) {
          resolve(mockRules.filter((r) => r.domain === domain));
        }
        resolve(mockRules);
      }, 350);
    });
  },

  createRule: async (rule) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const newRule: BusinessRule = {
          ...rule,
          id: `RUL-${String(mockRules.length + 1).padStart(3, '0')}`,
          createdBy: 'Steward Agent',
          lastUpdated: new Date().toISOString().replace('T', ' ').substring(0, 19)
        };
        mockRules.push(newRule);
        resolve(newRule);
      }, 400);
    });
  },

  toggleRuleStatus: async (id) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const found = mockRules.find((r) => r.id === id);
        if (found) {
          found.status = found.status === 'active' ? 'inactive' : 'active';
          found.lastUpdated = new Date().toISOString().replace('T', ' ').substring(0, 19);
          resolve(found);
        } else {
          resolve(null);
        }
      }, 300);
    });
  },

  deleteRule: async (id) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const index = mockRules.findIndex((r) => r.id === id);
        if (index > -1) {
          mockRules.splice(index, 1);
          resolve(true);
        } else {
          resolve(false);
        }
      }, 300);
    });
  }
};
