'use client';

// Configurações → Auditoria (só administrador).
// Lista as últimas alterações registradas pelo próprio banco (tabela auditoria):
// quem, quando, em qual registro e quais campos mudaram. Ninguém edita esse histórico.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { History, RefreshCw } from 'lucide-react';
import { supabaseNavegador } from '@/lib/supabase/navegador';
import { identidade } from '@/components/nexa/remoto';
import { useClientes, useLeads, useProjetos } from '@/components/nexa/dados';
import u from '@/components/nexa/ui.module.css';
import a from './acesso.module.css';

type Evento = { id: string; em: string; perfil_id: string | null; origem: string; tabela: string; registro_id: string; acao: string; campos: string[] };

const TABELAS: Record<string, string> = {
  leads: 'Lead',
  clientes: 'Cliente',
  vendas: 'Venda',
  projetos: 'Projeto',
  documentos: 'Documento',
  conversas: 'Conversa',
  servicos: 'Serviço',
  metas: 'Metas',
  prestadora: 'Dados da prestadora',
  preferencias: 'Preferências',
  avisos: 'Configuração de avisos',
  dias_trabalho: 'Dias de trabalho',
  categorias_arquivos: 'Categoria de arquivos',
  perfis: 'Usuário',
  equipes: 'Equipe',
  equipe_membros: 'Membro de equipe',
  convites_workspace: 'Convite',
  workspaces: 'Workspace',
};
const ACOES: Record<string, string> = { criar: 'criou', editar: 'alterou', excluir: 'excluiu', restaurar: 'restaurou' };
const CAMPOS: Record<string, string> = {
  conteudo: 'dados',
  etapa: 'etapa/fase',
  responsavel: 'responsável',
  valor: 'valor',
  pagamento: 'pagamento',
  parcelas: 'parcelas',
  tarefasProjeto: 'tarefas',
  documentos: 'documentos',
  mensagens: 'mensagens',
  status: 'status',
  ativo: 'acesso ativo',
  papel: 'perfil de acesso',
  codigoPublico: 'link de acompanhamento',
  nome: 'nome',
  cargo: 'cargo',
  email: 'e-mail',
};

export default function Auditoria() {
  const [eventos, setEventos] = useState<Evento[] | null>(null);
  const [pessoas, setPessoas] = useState<Record<string, string>>({});
  const [erro, setErro] = useState('');
  const [leads] = useLeads();
  const [clientes] = useClientes();
  const [projetos] = useProjetos();
  const admin = identidade()?.papel === 'administrador';

  const carregar = useCallback(async () => {
    setErro('');
    const db = supabaseNavegador();
    const [e, p] = await Promise.all([
      db.from('auditoria').select('id,em,perfil_id,origem,tabela,registro_id,acao,campos').order('em', { ascending: false }).limit(150),
      db.from('perfis').select('id,nome,email'),
    ]);
    if (e.error) {
      setErro('Não foi possível ler a auditoria.');
      return;
    }
    setEventos((e.data ?? []) as Evento[]);
    setPessoas(Object.fromEntries((p.data ?? []).map((x: { id: string; nome: string | null; email: string | null }) => [x.id, x.nome || x.email || 'Usuário'])));
  }, []);

  useEffect(() => {
    if (admin) void carregar();
  }, [admin, carregar]);

  // nome legível do registro, quando ele ainda existe
  const nomes = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of leads) m.set(`leads/${l.id}`, l.empresa);
    for (const c of clientes) m.set(`clientes/${c.id}`, c.nome);
    for (const p of projetos) m.set(`projetos/${p.id}`, `${p.codigo ?? ''} ${p.servico}`.trim());
    return m;
  }, [leads, clientes, projetos]);

  if (!admin) return null;

  return (
    <section className={u.painel} id="auditoria">
      <header className={u.painelTopo}>
        <History size={28} strokeWidth={1.7} />
        <div>
          <h2>Auditoria</h2>
          <small>Últimas 150 alterações registradas pelo banco. Este histórico não pode ser editado nem apagado pelo sistema.</small>
        </div>
        <button type="button" className={`${a.btnPequeno} ${u.empurra}`} onClick={() => void carregar()}>
          <RefreshCw size={14} /> Atualizar
        </button>
      </header>
      {erro ? (
        <p className={u.nota} style={{ color: '#ffb199' }}>
          {erro}
        </p>
      ) : eventos === null ? (
        <p className={u.nota}>Carregando…</p>
      ) : !eventos.length ? (
        <p className={u.nota}>Nenhuma alteração registrada ainda.</p>
      ) : (
        <div className={a.tabelaRolagem}>
          <table className={a.auditoria}>
            <thead>
              <tr>
                <th>Quando</th>
                <th>Quem</th>
                <th>O que</th>
                <th>Campos</th>
              </tr>
            </thead>
            <tbody>
              {eventos.map((ev) => {
                const nome = ev.tabela === 'perfis' ? pessoas[ev.registro_id] : nomes.get(`${ev.tabela}/${ev.registro_id}`);
                return (
                  <tr key={ev.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{new Date(ev.em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                    <td>{ev.perfil_id ? pessoas[ev.perfil_id] ?? 'Usuário removido' : <small>operação administrativa do banco</small>}</td>
                    <td>
                      {ACOES[ev.acao] ?? ev.acao} {TABELAS[ev.tabela] ?? ev.tabela}
                      {nome ? `: ${nome}` : ''}
                      {!nome && ev.registro_id !== '@' && (
                        <>
                          {' '}
                          <small>({ev.registro_id.slice(0, 40)})</small>
                        </>
                      )}
                    </td>
                    <td>
                      <small>{ev.campos.map((c) => CAMPOS[c] ?? c).join(', ')}</small>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
