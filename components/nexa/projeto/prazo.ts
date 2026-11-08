// Texto e tom do prazo de entrega (cabeçalho e painel lateral).

import { dataBr, diasAte } from '../financeiro';

export type TomPrazo = 'neutro' | 'ok' | 'atencao' | 'atrasado';

export function infoPrazo(prazo: string | undefined, concluido: boolean, hoje?: string): { texto: string; curto: string; tom: TomPrazo; dias: number | null } {
  if (!prazo) return { texto: 'Prazo não definido', curto: 'Sem prazo', tom: 'neutro', dias: null };
  if (concluido) return { texto: 'Projeto concluído', curto: `${dataBr(prazo)} · concluído`, tom: 'ok', dias: null };
  const d = diasAte(prazo, hoje);
  if (d === 0) return { texto: 'Entrega hoje', curto: `${dataBr(prazo)} · hoje`, tom: 'atencao', dias: d };
  if (d < 0) {
    const t = d === -1 ? 'Atrasado há 1 dia' : `Atrasado há ${-d} dias`;
    return { texto: t, curto: `${dataBr(prazo)} · atrasado`, tom: 'atrasado', dias: d };
  }
  const t = d === 1 ? 'Falta 1 dia' : `Faltam ${d} dias`;
  return { texto: t, curto: `${dataBr(prazo)} · ${d === 1 ? 'em 1 dia' : `em ${d} dias`}`, tom: d <= 3 ? 'atencao' : 'neutro', dias: d };
}
