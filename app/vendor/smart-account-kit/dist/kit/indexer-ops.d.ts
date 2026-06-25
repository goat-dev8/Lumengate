import type { IndexerClient, IndexedContractSummary, ContractDetailsResponse } from "../indexer";
export declare function discoverContractsByCredential(indexer: IndexerClient | null, credentialId: string): Promise<IndexedContractSummary[] | null>;
export declare function discoverContractsByAddress(indexer: IndexerClient | null, address: string): Promise<IndexedContractSummary[] | null>;
export declare function getContractDetailsFromIndexer(indexer: IndexerClient | null, contractId: string): Promise<ContractDetailsResponse | null>;
//# sourceMappingURL=indexer-ops.d.ts.map