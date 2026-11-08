'use client';

// ============================================
// GERAR DOCUMENTOS (dentro de Documentos, no painel do lead)
// ============================================
// 1) escolher o tipo; 2) conferir o que falta (com atalho para preencher);
// 3) informações próprias do documento; 4) pré-visualizar; 5) imprimir/salvar PDF e salvar no lead.
// Nada que falta é inventado: aparece como [FALTA: …] e bloqueia o "Salvar no lead".
// ============================================

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CircleAlert, CircleCheck, Eye, FileCog, Printer, Save, X } from 'lucide-react';
import g from './gerador.module.css';
import type { DocumentoLead, Lead, TipoDocumento } from '../dados-exemplo';
import { usePrestadora, useDocumentos } from '../dados';
import { cobrancasDoLead, dataBr, dinheiro } from '../financeiro';
import { guardarArquivo, tamanhoLegivel } from '../arquivos';
import {
  COMPLEMENTOS_PADRAO,
  montarHtml,
  pendencias,
  TIPOS_DOC,
  type ComplementosDoc,
  type Pendencia,
  type TipoDocLead,
} from '../documentos/modelos';

const NOME_NO_GERADOR: Record<TipoDocLead, TipoDocumento> = {
  proposta: 'Proposta',
  contrato: 'Contrato',
  os: 'Ordem de serviço',
  aditivo: 'Contrato',
  recibo: 'Recibo',
  ficha: 'Ficha de dados',
};

/** Campos próprios de cada tipo de documento */
const CAMPOS_DOC: Partial<Record<TipoDocLead, Array<{ chave: keyof ComplementosDoc; rotulo: string; tipo?: 'texto' | 'numero' | 'area' }>>> = {
  proposta: [
    { chave: 'entregas', rotulo: 'O que será entregue (um item por linha)', tipo: 'area' },
    { chave: 'exclusoes', rotulo: 'Não incluído (opcional)' },
    { chave: 'suporte', rotulo: 'Suporte (opcional)' },
    { chave: 'validade', rotulo: 'Validade da proposta (dias)', tipo: 'numero' },
  ],
  contrato: [
    { chave: 'prazoResposta', rotulo: 'Prazo de resposta (dias úteis)', tipo: 'numero' },
    { chave: 'prazoCorrecao', rotulo: 'Prazo para corrigir pendências (dias úteis)', tipo: 'numero' },
    { chave: 'anosSigilo', rotulo: 'Sigilo (anos)', tipo: 'numero' },
    { chave: 'prazoDisputa', rotulo: 'Prazo para resolver divergências (dias úteis)', tipo: 'numero' },
  ],
  os: [
    { chave: 'entregas', rotulo: 'O que será entregue (um item por linha)', tipo: 'area' },
    { chave: 'exclusoes', rotulo: 'Exclusões (opcional)' },
    { chave: 'prazoValidacao', rotulo: 'Prazo para testar (dias úteis)', tipo: 'numero' },
    { chave: 'prazoDefeitos', rotulo: 'Prazo para corrigir defeitos (dias)', tipo: 'numero' },
    { chave: 'suporte', rotulo: 'Suporte (opcional)' },
  ],
};

let logoEmbutido: string | null = null;
/** O logo vai dentro do arquivo salvo, para abrir mesmo sem o sistema ligado. */
async function logoDataUrl(): Promise<string> {
  if (logoEmbutido) return logoEmbutido;
  try {
    const blob = await (await fetch('/dashboard/simbolo-nexa.png')).blob();
    logoEmbutido = await new Promise<string>((ok) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result));
      r.readAsDataURL(blob);
    });
  } catch {
    logoEmbutido = '/dashboard/simbolo-nexa.png';
  }
  return logoEmbutido;
}

type Props = {
  lead: Lead;
  onAtualizar: (m: Partial<Lead>) => void;
  /** Leva até um campo do painel (Dados do Lead / Pagamento) */
  onIrPara: (p: Pendencia) => void;
};

export default function GeradorDocumentos({ lead, onAtualizar, onIrPara }: Props) {
  const [prestadora] = usePrestadora();
  const [docsGerador, setDocsGerador] = useDocumentos();
  const [tipo, setTipo] = useState<TipoDocLead>('proposta');
  const [previa, setPrevia] = useState<string | null>(null);
  const [aviso, setAviso] = useState('');
  const iframe = useRef<HTMLIFrameElement>(null);

  const comp: ComplementosDoc = { ...COMPLEMENTOS_PADRAO, ...(lead.complementosDoc ?? {}) };
  const info = TIPOS_DOC.find((t) => t.id === tipo)!;
  const faltam = pendencias(tipo, { lead, prestadora, comp });
  const pagas = cobrancasDoLead(lead).filter((c) => c.pago && c.pagoEm);

  useEffect(() => setAviso(''), [tipo, lead.id]);

  const salvarComp = (chave: keyof ComplementosDoc, valor: string) =>
    onAtualizar({ complementosDoc: { ...(lead.complementosDoc ?? {}), [chave]: valor.trim() || undefined } });

  const preVisualizar = async () => setPrevia(montarHtml({ tipo, lead, prestadora, comp, logoUrl: await logoDataUrl() }));

  const salvarNoLead = async () => {
    if (faltam.length || !previa) return;
    const cliente = lead.cadastro?.nomeCompleto?.trim() || lead.empresa;
    // Versão: conta quantos documentos deste tipo o lead já gerou (os anteriores ficam guardados)
    const versao = docsGerador.filter((d) => d.leadId === lead.id && d.tipo === NOME_NO_GERADOR[tipo]).length + 1;
    const agora = new Date();
    const nome = `${info.nome} – ${cliente} – v${versao}.html`;
    const arquivo = new File([previa], nome, { type: 'text/html' });
    const arquivoId = await guardarArquivo(arquivo);
    const id = `d-${agora.getTime()}`;
    setDocsGerador((l) => [
      {
        id,
        titulo: `${info.nome} – ${cliente}`,
        tipo: NOME_NO_GERADOR[tipo],
        descricao: info.minuta ? 'Gerado no lead · minuta, revisão jurídica pendente' : 'Gerado no lead',
        atualizado: agora.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        leadId: lead.id,
        arquivoId,
        versao,
        criadoEm: agora.toISOString(),
      },
      ...l,
    ]);
    const novo: DocumentoLead = {
      id: `doc-${id}`,
      nome,
      tamanho: tamanhoLegivel(arquivo.size),
      tipo: 'gerado',
      origem: 'sistema',
      arquivoId,
      documentoId: id,
      em: new Date().toISOString(),
    };
    onAtualizar({ documentos: [...(lead.documentos ?? []), novo] });
    setAviso(`"${info.nome}" salvo nos documentos do lead.`);
    setPrevia(null);
  };

  const imprimir = () => {
    const w = iframe.current?.contentWindow;
    if (w) {
      w.focus();
      w.print();
    }
  };

  const ondeTexto = (p: Pendencia) =>
    p.onde === 'configuracoes' ? 'Configurações' : p.onde === 'pagamento' ? 'Pagamento' : p.onde === 'documento' ? 'neste documento' : 'Dados do Lead';

  return (
    <div className={g.gerador}>
      <label className={g.campo}>
        <span>
          <FileCog size={15} /> Gerar documento
        </span>
        <select value={tipo} onChange={(e) => { setTipo(e.target.value as TipoDocLead); setPrevia(null); }} aria-label="Tipo de documento">
          {TIPOS_DOC.map((t) => (
            <option key={t.id} value={t.id} disabled={!t.disponivel}>
              {t.nome}
              {!t.disponivel ? ' (modelo pendente)' : ''}
            </option>
          ))}
        </select>
      </label>
      <p className={g.nota}>{info.nota}</p>

      {/* Campos próprios do documento */}
      {(CAMPOS_DOC[tipo] ?? []).length > 0 && (
        <div className={g.camposDoc}>
          {(CAMPOS_DOC[tipo] ?? []).map((cp) => (
            <label key={cp.chave} className={`${g.campo} ${cp.tipo === 'area' ? g.campoLargo : ''}`}>
              <span>{cp.rotulo}</span>
              {cp.tipo === 'area' ? (
                <textarea id={`doc-${cp.chave}`} defaultValue={comp[cp.chave] ?? ''} key={`${lead.id}-${cp.chave}-${comp[cp.chave] ?? ''}`} rows={3} onBlur={(e) => e.currentTarget.value.trim() !== (comp[cp.chave] ?? '') && salvarComp(cp.chave, e.currentTarget.value)} />
              ) : (
                <input
                  id={`doc-${cp.chave}`}
                  inputMode={cp.tipo === 'numero' ? 'numeric' : undefined}
                  defaultValue={comp[cp.chave] ?? ''}
                  key={`${lead.id}-${cp.chave}-${comp[cp.chave] ?? ''}`}
                  onBlur={(e) => e.currentTarget.value.trim() !== (comp[cp.chave] ?? '') && salvarComp(cp.chave, e.currentTarget.value)}
                />
              )}
            </label>
          ))}
        </div>
      )}

      {tipo === 'recibo' && pagas.length > 0 && (
        <label className={g.campo}>
          <span>Pagamento do recibo</span>
          <select id="doc-cobrancaRecibo" value={comp.cobrancaRecibo ?? ''} onChange={(e) => salvarComp('cobrancaRecibo', e.target.value)}>
            <option value="">Escolha…</option>
            {pagas.map((c) => (
              <option key={c.chave} value={c.chave}>
                {c.rotulo} · {dinheiro(c.valor)} · pago em {dataBr(c.pagoEm)}
              </option>
            ))}
          </select>
        </label>
      )}

      {/* Validação */}
      {faltam.length > 0 ? (
        <div className={g.faltam} role="status">
          <p>
            <CircleAlert size={15} /> Para gerar {info.nome.toLowerCase()}, falta preencher:
          </p>
          <ul>
            {faltam.map((p) => (
              <li key={p.rotulo}>
                <span>
                  {p.rotulo} <small>({ondeTexto(p)})</small>
                </span>
                {p.onde === 'configuracoes' ? (
                  <Link href="/configuracoes#prestadora">Preencher</Link>
                ) : info.disponivel ? (
                  <button type="button" onClick={() => onIrPara(p)}>
                    Preencher
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className={g.ok}>
          <CircleCheck size={15} /> Tudo preenchido para {info.nome.toLowerCase()}.
        </p>
      )}

      <div className={g.botoes}>
        <button type="button" className={g.btnSec} onClick={preVisualizar} disabled={!info.disponivel}>
          <Eye size={16} /> Pré-visualizar
        </button>
      </div>
      {aviso && (
        <p className={g.ok} role="status">
          {aviso}
        </p>
      )}

      {previa && (
        <div className={g.fundo} onClick={() => setPrevia(null)}>
          <div className={g.janela} role="dialog" aria-modal="true" aria-label={`Pré-visualização: ${info.nome}`} onClick={(e) => e.stopPropagation()}>
            <header className={g.janelaTopo}>
              <strong>{info.nome}</strong>
              {faltam.length > 0 && <span className={g.seloFalta}>{faltam.length} pendência(s)</span>}
              <button type="button" className={g.btnSec} onClick={imprimir}>
                <Printer size={16} /> Imprimir / salvar PDF
              </button>
              <button
                type="button"
                className={g.btnPri}
                onClick={salvarNoLead}
                disabled={faltam.length > 0}
                title={faltam.length ? 'Preencha o que falta para salvar' : 'Salvar nos documentos do lead'}
              >
                <Save size={16} /> Salvar no lead
              </button>
              <button type="button" className={g.fechar} onClick={() => setPrevia(null)} aria-label="Fechar pré-visualização">
                <X size={18} />
              </button>
            </header>
            <iframe ref={iframe} className={g.folha} srcDoc={previa} title={`Pré-visualização de ${info.nome}`} />
          </div>
        </div>
      )}
    </div>
  );
}
