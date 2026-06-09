export interface FactcheckCost {
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  cost_krw: number;
}

export interface FactcheckRecord {
  id: string;
  title: string;
  markdown: string;
  createdAt: string;
  dateKst: string;
  timeKst: string;
  retried: boolean;
  cost: FactcheckCost;
}

export interface RecentSummary {
  id: string;
  createdAt: string;
  dateKst: string;
  title: string;
  preview: string;
  costKrw: number;
}
