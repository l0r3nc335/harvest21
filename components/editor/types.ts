export type OutputData = {
  blocks: Array<{
    id?: string;
    type: string;
    data: Record<string, unknown>;
  }>;
  version?: string;
};


