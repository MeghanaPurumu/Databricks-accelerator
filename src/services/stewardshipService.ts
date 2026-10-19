import { StewardshipTask } from '../types';
import { getStoredDuplicates } from './matchingService';

export interface StewardshipService {
  getTasks(params?: { type?: string; priority?: string; status?: string; assignedTo?: string }): Promise<StewardshipTask[]>;
  getTask(id: string): Promise<StewardshipTask | null>;
  assignTask(id: string, stewardName: string): Promise<boolean>;
  updateTaskStatus(id: string, status: StewardshipTask['status']): Promise<boolean>;
  getSummary(): Promise<{ totalOpen: number; highPriority: number; duplicatesCount: number; qualityCount: number; unassignedCount: number }>;
}

export const mockStewardshipService: StewardshipService = {
  getTasks: async (params) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        // Generate duplicate review tasks dynamically from active pending duplicates
        const pendingDuplicates = getStoredDuplicates().filter(d => d.status === 'pending');
        const generatedTasks: StewardshipTask[] = pendingDuplicates.map((d, index) => ({
          id: `TSK-DUP-${d.id}`,
          priority: d.matchScore > 0.90 ? 'high' : 'medium',
          type: 'duplicate_review',
          recordId: d.id,
          recordName: `${d.recordA.name} & ${d.recordB.name}`,
          issue: `Potential duplicate customer records found with ${Math.round(d.matchScore * 100)}% match score.`,
          severityScore: Math.round(d.matchScore * 100),
          assignedTo: index % 2 === 0 ? 'Jane Doe' : 'Unassigned',
          age: `${index + 1} hours ago`,
          status: 'open'
        }));

        // Customer quality issues (Product/Supplier/Location removed)
        const qualityTasks: StewardshipTask[] = [
          {
            id: 'TSK-QL-001',
            priority: 'high',
            type: 'quality_issue',
            recordId: 'EXC-002',
            recordName: 'Sarah Connor',
            issue: 'Critical validation failure: Email address domain format invalid.',
            severityScore: 99,
            assignedTo: 'Unassigned',
            age: '1 day ago',
            status: 'open'
          },
          {
            id: 'TSK-QL-002',
            priority: 'medium',
            type: 'quality_issue',
            recordId: 'EXC-001',
            recordName: 'Jon Smith',
            issue: 'Validation exception: US Zipcode format invalid.',
            severityScore: 82,
            assignedTo: 'Jane Doe',
            age: '3 days ago',
            status: 'open'
          }
        ];

        let allTasks = [...generatedTasks, ...qualityTasks];

        if (params?.type) {
          allTasks = allTasks.filter((t) => t.type === params.type);
        }
        if (params?.priority) {
          allTasks = allTasks.filter((t) => t.priority === params.priority);
        }
        if (params?.status) {
          allTasks = allTasks.filter((t) => t.status === params.status);
        }
        if (params?.assignedTo) {
          if (params.assignedTo === 'Unassigned') {
            allTasks = allTasks.filter((t) => t.assignedTo === 'Unassigned' || t.assignedTo === '');
          } else {
            allTasks = allTasks.filter((t) => t.assignedTo === params.assignedTo);
          }
        }
        resolve(allTasks);
      }, 100);
    });
  },

  getTask: async (id) => {
    return new Promise((resolve) => {
      mockStewardshipService.getTasks().then(tasks => {
        resolve(tasks.find(t => t.id === id) || null);
      });
    });
  },

  assignTask: async (id, stewardName) => {
    return Promise.resolve(true);
  },

  updateTaskStatus: async (id, status) => {
    return Promise.resolve(true);
  },

  getSummary: async () => {
    return new Promise((resolve) => {
      mockStewardshipService.getTasks().then(tasks => {
        const openTasks = tasks.filter((t) => t.status !== 'resolved');
        const summary = {
          totalOpen: openTasks.length,
          highPriority: openTasks.filter((t) => t.priority === 'high').length,
          duplicatesCount: openTasks.filter((t) => t.type === 'duplicate_review').length,
          qualityCount: openTasks.filter((t) => t.type === 'quality_issue').length,
          unassignedCount: openTasks.filter((t) => t.assignedTo === 'Unassigned' || t.assignedTo === '').length
        };
        resolve(summary);
      });
    });
  }
};
