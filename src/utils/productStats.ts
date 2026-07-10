import { MOCK_PROPOSAL_DETAILS } from '../data/mockProposals';

export interface ProductStatsProposal {
  code: string;
  cliente: string;
  qty: number;
  status: string;
}

export interface ProductStats {
  timesSold: number;
  revenue: number;
  proposals: ProductStatsProposal[];
}

/**
 * Analytics de produto (RF sugerido pelo Henrique): quantas vezes foi vendido — ou seja,
 * apareceu em propostas — e em quais. Calculado varrendo `MOCK_PROPOSAL_DETAILS`, já que o
 * backend real ainda não expõe esse agregado.
 */
export function getProductStats(productId: string): ProductStats {
  const proposals: ProductStatsProposal[] = [];
  let timesSold = 0;
  let revenue = 0;

  Object.values(MOCK_PROPOSAL_DETAILS).forEach((detail) => {
    detail.itens.forEach((item) => {
      if (item.code !== productId) return;
      timesSold += item.qty;
      revenue += item.qty * item.price * (1 - item.disc / 100);
      proposals.push({ code: detail.code, cliente: detail.cliente, qty: item.qty, status: detail.status });
    });
  });

  return { timesSold, revenue, proposals };
}
