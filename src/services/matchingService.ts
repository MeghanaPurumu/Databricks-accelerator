import { MasterRecord, SourceRecord, GoldenRecord, PotentialDuplicate } from '../types';
import { getLocalStorageData, saveLocalStorageData, getStoredMasterRecords, getStoredGoldenRecords } from './masterDataService';

export interface MatchingService {
  getPotentialDuplicates(): Promise<PotentialDuplicate[]>;
  getPotentialDuplicate(id: string): Promise<PotentialDuplicate | null>;
  mergeRecords(
    duplicateId: string,
    survivingAttributes: Record<string, string | number | boolean>
  ): Promise<{ success: boolean; mergedRecordId: string; message: string }>;
  rejectDuplicate(id: string): Promise<boolean>;
  markNotDuplicate(id: string): Promise<boolean>;
  updateDuplicateStatus(id: string, status: PotentialDuplicate['status']): Promise<boolean>;
}

export const getStoredDuplicates = (): PotentialDuplicate[] =>
  getLocalStorageData<PotentialDuplicate[]>('lf_duplicates', []);


export const mockMatchingService: MatchingService = {
  getPotentialDuplicates: async () => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(getStoredDuplicates().filter((d) => d.status === 'pending'));
      }, 100);
    });
  },

  getPotentialDuplicate: async (id) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const found = getStoredDuplicates().find((d) => d.id === id) || null;
        resolve(found);
      }, 100);
    });
  },

  mergeRecords: async (duplicateId, survivingAttributes) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const duplicates = getStoredDuplicates();
        const duplicate = duplicates.find((d) => d.id === duplicateId);
        
        if (duplicate) {
          // 1. Update duplicate status
          duplicate.status = 'merged';
          saveLocalStorageData('lf_duplicates', duplicates);

          // 2. Perform merge in master records & golden records
          const masterRecords = getStoredMasterRecords();
          const goldenRecords = getStoredGoldenRecords();

          const recA = masterRecords.find(r => r.id === duplicate.recordA.id);
          const recB = masterRecords.find(r => r.id === duplicate.recordB.id);

          if (recA && recB) {
            const goldIdA = recA.goldenRecordId;
            const goldIdB = recB.goldenRecordId;

            // We will merge B into A's cluster
            const targetGoldId = goldIdA || goldIdB || `GOLD-CUST-MERGED-${recA.id}`;

            // Update all records with goldIdB or goldIdA to point to targetGoldId
            masterRecords.forEach(r => {
              if (r.goldenRecordId === goldIdB || r.goldenRecordId === goldIdA) {
                r.goldenRecordId = targetGoldId;
                r.matchStatus = 'matched';
              }
            });

            // Find or create the surviving Golden Record
            let goldRec = goldenRecords.find(g => g.id === targetGoldId);
            
            // Count total source records now in this cluster
            const clusterMembers = masterRecords.filter(r => r.goldenRecordId === targetGoldId);
            const totalCount = clusterMembers.length;
            const sourcesList = Array.from(new Set(clusterMembers.map(r => r.sourceSystem)));

            if (!goldRec) {
              goldRec = {
                id: targetGoldId,
                entity: 'Customer',
                masterName: String(survivingAttributes.name || recA.name),
                sourceRecordsCount: totalCount,
                sources: sourcesList,
                qualityScore: 98.5,
                confidence: 99.0,
                status: 'active',
                lastUpdated: new Date().toISOString().replace('T', ' ').substring(0, 19)
              };
              goldenRecords.push(goldRec);
            } else {
              goldRec.masterName = String(survivingAttributes.name || goldRec.masterName);
              goldRec.sourceRecordsCount = totalCount;
              goldRec.sources = sourcesList;
              goldRec.lastUpdated = new Date().toISOString().replace('T', ' ').substring(0, 19);
            }

            // Remove or deprecate the duplicate golden record B
            if (goldIdB && goldIdB !== goldIdA) {
              const bIndex = goldenRecords.findIndex(g => g.id === goldIdB);
              if (bIndex > -1) {
                goldenRecords.splice(bIndex, 1);
              }
            }

            saveLocalStorageData('lf_master_records', masterRecords);
            saveLocalStorageData('lf_golden_records', goldenRecords);
          }

          resolve({
            success: true,
            mergedRecordId: duplicate.recordA.id,
            message: `Successfully merged duplicate pair ${duplicateId}. Resolved attributes persisted in golden master tables.`
          });
        } else {
          resolve({
            success: false,
            mergedRecordId: '',
            message: `Duplicate record with ID ${duplicateId} not found.`
          });
        }
      }, 200);
    });
  },

  rejectDuplicate: async (id) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const duplicates = getStoredDuplicates();
        const found = duplicates.find((d) => d.id === id);
        if (found) {
          found.status = 'rejected';
          saveLocalStorageData('lf_duplicates', duplicates);
          resolve(true);
        } else {
          resolve(false);
        }
      }, 100);
    });
  },

  markNotDuplicate: async (id) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const duplicates = getStoredDuplicates();
        const found = duplicates.find((d) => d.id === id);
        if (found) {
          found.status = 'not_a_duplicate';
          saveLocalStorageData('lf_duplicates', duplicates);
          
          const masterRecords = getStoredMasterRecords();
          const recA = masterRecords.find(r => r.id === found.recordA.id);
          const recB = masterRecords.find(r => r.id === found.recordB.id);
          if (recA) recA.matchStatus = 'unmatched';
          if (recB) recB.matchStatus = 'unmatched';
          saveLocalStorageData('lf_master_records', masterRecords);

          resolve(true);
        } else {
          resolve(false);
        }
      }, 100);
    });
  },

  updateDuplicateStatus: async (id, status) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const duplicates = getStoredDuplicates();
        const found = duplicates.find((d) => d.id === id);
        if (found) {
          found.status = status;
          saveLocalStorageData('lf_duplicates', duplicates);
          resolve(true);
        } else {
          resolve(false);
        }
      }, 100);
    });
  }
};
