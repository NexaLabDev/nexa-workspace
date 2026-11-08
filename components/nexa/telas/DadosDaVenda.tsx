'use client';

// Bloco "Veio da venda" dentro do projeto do Kanban: dados, documentos,
// anotações e tarefas copiados da conversa quando o lead virou Venda ganha.

import Link from 'next/link';
import { AlarmClock, Download, ExternalLink, FilePen, FileText, MessageSquareMore, Trophy } from 'lucide-react';
import k from './kanban.module.css';
import type { Projeto } from '../dados-exemplo';
import { CAMPOS_CADASTRO } from '../dados';
import {
  cobrancasDoLead,
  dataBr,
  dinheiro,
  normalizarPagamento,
  resumoMensalidadeTexto,
  resumoPagamentoTexto,
  situacaoCobranca,
} from '../financeiro';
import { baixarArquivo } from '../arquivos';
import { reais } from '../util';

function dataCurta(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR');
}

export default function DadosDaVenda({ projeto }: { projeto: Projeto }) {
  if (!projeto.leadId) return null;
  const cad = projeto.cadastro ?? {};
  const preenchidos = CAMPOS_CADASTRO.filter((cp) => cad[cp.chave]?.trim());
  const docs = projeto.documentos ?? [];
  const anot = projeto.anotacoes ?? [];
  const tarefas = projeto.tarefas ?? [];
  const pg = normalizarPagamento(projeto.pagamento);
  // monta as cobranças a partir da cópia guardada no projeto
  const cobrancas = cobrancasDoLead({
    id: projeto.leadId,
    empresa: projeto.cliente,
    descricao: projeto.descricao ?? '',
    valor: projeto.valor ?? null,
    cor: '',
    etapa: 'ganho',
    pagamento: projeto.pagamento,
    mensalidade: projeto.mensalidade,
  });

  return (
    <div className={k.venda}>
      <div className={k.vendaTopo}>
        <Trophy size={18} />
        <strong>Veio da venda</strong>
        <span>
          {projeto.valor != null ? reais(projeto.valor) : 'sem valor'} · ganha em {dataCurta(projeto.vendidoEm)}
        </span>
      </div>

      <div className={k.vendaLinks}>
        <Link href={`/conversas?lead=${projeto.leadId}`} className={k.vendaLink}>
          <MessageSquareMore size={16} /> Abrir conversa
        </Link>
        <Link href={`/crm?lead=${projeto.leadId}`} className={k.vendaLink}>
          <ExternalLink size={16} /> Ficha no CRM
        </Link>
      </div>

      <h4>Dados do cliente</h4>
      {preenchidos.length || projeto.email || projeto.telefone ? (
        <dl className={k.dados}>
          {preenchidos.map((cp) => (
            <div key={cp.chave}>
              <dt>{cp.rotulo}</dt>
              <dd>{cad[cp.chave]}</dd>
            </div>
          ))}
          {projeto.email && (
            <div>
              <dt>E-mail</dt>
              <dd>{projeto.email}</dd>
            </div>
          )}
          {projeto.telefone && (
            <div>
              <dt>Telefone</dt>
              <dd>{projeto.telefone}</dd>
            </div>
          )}
        </dl>
      ) : (
        <p className={k.vazio}>Nenhum dado preenchido no Fechamento.</p>
      )}

      <h4>Pagamento</h4>
      {cobrancas.length ? (
        <>
          {pg && <p className={k.resumoPag}>{resumoPagamentoTexto(pg)}</p>}
          {pg?.modalidade === 'entrada' && <p className={k.vazio}>Condição de entrada + parcelas: consta no contrato.</p>}
          {pg?.observacao && <p className={k.vazio}>{pg.observacao}</p>}
          {projeto.mensalidade?.ativa && <p className={k.resumoPag}>{resumoMensalidadeTexto(projeto.mensalidade)}</p>}
          <ul className={k.lista}>
            {cobrancas.map((it) => {
              const sit = situacaoCobranca(it);
              return (
                <li key={it.chave}>
                  <span>
                    {it.rotulo} · {dinheiro(it.valor)}
                    <small>
                      {it.vencimento ? `Vence ${dataBr(it.vencimento)} · ` : ''}
                      <b className={sit === 'paga' ? k.paga : sit === 'vencida' ? k.atrasada : ''}>
                        {sit === 'paga' ? `Paga${it.pagoEm ? ` em ${dataBr(it.pagoEm)}` : ''}` : sit === 'vencida' ? 'Vencida' : 'Pendente'}
                      </b>
                      {it.comprovante ? ' · com comprovante' : ''}
                    </small>
                  </span>
                  {it.comprovante?.arquivoId && (
                    <button type="button" onClick={() => baixarArquivo(it.comprovante!.arquivoId!, it.comprovante!.nome)} aria-label={`Baixar comprovante ${it.rotulo}`}>
                      <Download size={16} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          <p className={k.vazio}>Situação copiada na data da venda. O acompanhamento atualizado fica em Recebimentos.</p>
        </>
      ) : (
        <p className={k.vazio}>Pagamento não registrado no lead.</p>
      )}

      <h4>Documentos ({docs.length})</h4>
      {docs.length ? (
        <ul className={k.lista}>
          {docs.map((d) => (
            <li key={d.id}>
              {d.tipo === 'gerado' ? <FilePen size={16} /> : <FileText size={16} />}
              <span>
                {d.nome}
                <small>
                  {d.origem === 'cliente' ? 'Enviado pelo cliente' : d.origem === 'sistema' ? 'Rascunho gerado' : 'Anexado pela equipe'}
                  {d.tamanho ? ` · ${d.tamanho}` : ''}
                </small>
              </span>
              {d.arquivoId && (
                <button type="button" onClick={() => baixarArquivo(d.arquivoId!, d.nome)} aria-label={`Baixar ${d.nome}`}>
                  <Download size={16} />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className={k.vazio}>Nenhum documento.</p>
      )}

      {anot.length > 0 && (
        <>
          <h4>Anotações</h4>
          <ul className={k.lista}>
            {anot.map((a, i) => (
              <li key={`${a.em}-${i}`}>
                <span>↳ {a.texto}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {tarefas.length > 0 && (
        <>
          <h4>Tarefas da negociação</h4>
          <ul className={k.lista}>
            {tarefas.map((t) => (
              <li key={t.id}>
                <span className={t.feita ? k.feita : ''}>
                  {t.feita ? '✓ ' : '○ '}
                  {t.texto}
                  {t.prazo && (
                    <small>
                      <AlarmClock size={12} /> {t.prazo}
                    </small>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
