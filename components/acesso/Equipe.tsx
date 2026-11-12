'use client';

// Configurações → Conta e equipe.
// Minha conta (nome, cargo, senha, sair) · Pessoas e perfis de acesso · Equipes · Convites.
// Tudo passa pelas regras do banco (RLS): a tela só esconde o que a pessoa não pode fazer.
// - Administrador: tudo. Gestor: gerencia colaboradores e visualizadores e as equipes.
// - Convite: o administrador gera um link e envia à pessoa; ela cria a senha, confirma o
//   e-mail e entra como visualizador. Depois o perfil pode ser ajustado aqui.

import { useCallback, useEffect, useState } from 'react';
import { KeyRound, LogOut, UserRound, Users } from 'lucide-react';
import { supabaseNavegador } from '@/lib/supabase/navegador';
import { origemPublica } from '@/components/nexa/acompanhamento';
import u from '@/components/nexa/ui.module.css';
import a from './acesso.module.css';

type Papel = 'administrador' | 'gestor' | 'colaborador' | 'visualizador';
type Perfil = { id: string; email: string | null; nome: string | null; cargo: string | null; papel: Papel; ativo: boolean };
type Time = { id: string; nome: string };
type Membro = { equipe_id: string; perfil_id: string };
type Convite = { id: string; email: string; expira_em: string };

const PAPEIS: Array<{ id: Papel; nome: string; resumo: string }> = [
  { id: 'administrador', nome: 'Administrador', resumo: 'acesso total: usuários, convites, auditoria, importação e configurações do workspace.' },
  { id: 'gestor', nome: 'Gestor', resumo: 'tudo do colaborador, mais metas, serviços, dados da prestadora, equipes e os perfis de colaboradores e visualizadores.' },
  { id: 'colaborador', nome: 'Colaborador', resumo: 'cria e edita leads, clientes, vendas, projetos, tarefas, documentos e arquivos.' },
  { id: 'visualizador', nome: 'Visualizador', resumo: 'só consulta; não altera nada.' },
];
const nomePapel = (p: string) => PAPEIS.find((x) => x.id === p)?.nome ?? p;

export default function Equipe() {
  const [lista, setLista] = useState<Perfil[]>([]);
  const [eu, setEu] = useState('');
  const [times, setTimes] = useState<Time[]>([]);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [convites, setConvites] = useState<Convite[]>([]);
  const [aviso, setAviso] = useState<{ texto: string; erro?: boolean } | null>(null);
  const [emailConvite, setEmailConvite] = useState('');
  const [nomeEquipe, setNomeEquipe] = useState('');
  const [novaSenha, setNovaSenha] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    const db = supabaseNavegador();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) return;
    const [p, t, m] = await Promise.all([
      db.from('perfis').select('id,email,nome,cargo,papel,ativo').order('email'),
      db.from('equipes').select('id,nome').order('nome'),
      db.from('equipe_membros').select('equipe_id,perfil_id'),
    ]);
    if (p.error || t.error || m.error) {
      setAviso({ texto: 'Não foi possível consultar a equipe. Confira a conexão.', erro: true });
      return;
    }
    setEu(user.id);
    setLista((p.data ?? []) as Perfil[]);
    setTimes(t.data ?? []);
    setMembros(m.data ?? []);
    // convites: só o administrador enxerga (para os demais a consulta volta vazia)
    const c = await db.from('convites_workspace').select('id,email,expira_em').is('aceito_em', null).order('email');
    setConvites(c.error ? [] : ((c.data ?? []) as Convite[]));
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const meu = lista.find((p) => p.id === eu);
  const admin = meu?.papel === 'administrador';
  const gerencia = admin || meu?.papel === 'gestor';
  const podeGerir = (p: Perfil) => p.id !== eu && (admin || (meu?.papel === 'gestor' && !['gestor', 'administrador'].includes(p.papel)));

  async function salvar(operacao: PromiseLike<{ error: unknown }>, sucesso = 'Alteração salva.') {
    setOcupado(true);
    try {
      const { error } = await operacao;
      if (error) throw error;
      setAviso({ texto: sucesso });
      await carregar();
      return true;
    } catch (e) {
      const msg = (e as { message?: string } | null)?.message ?? '';
      setAviso({
        texto: /administrador ativo/i.test(msg)
          ? 'O workspace precisa manter pelo menos um administrador ativo.'
          : /duplicate|unique/i.test(msg)
            ? 'Já existe um registro igual (mesmo nome ou e-mail).'
            : 'Não foi possível salvar. Verifique sua permissão e os dados.',
        erro: true,
      });
      await carregar();
      return false;
    } finally {
      setOcupado(false);
    }
  }

  const db = supabaseNavegador;
  const linkConvite = (id: string) => `${origemPublica(location.origin)}/login?convite=${id}`;

  return (
    <section className={u.painel} id="conta">
      <header className={u.painelTopo}>
        <UserRound size={28} strokeWidth={1.7} />
        <div>
          <h2>Conta e equipe</h2>
          <small>Seu acesso, as pessoas do workspace e o que cada perfil pode fazer.</small>
        </div>
      </header>

      {/* ---------- Minha conta ---------- */}
      <div className={a.bloco}>
        <h3>Minha conta</h3>
        {meu ? (
          <>
            <div className={a.linha}>
              <label className={u.campo}>
                <span>E-mail de acesso</span>
                <input className={u.entrada} value={meu.email ?? ''} readOnly />
              </label>
              <label className={u.campo}>
                <span>Nome (aparece nas atividades)</span>
                <input
                  className={u.entrada}
                  key={`nome-${meu.nome ?? ''}`}
                  defaultValue={meu.nome ?? ''}
                  maxLength={120}
                  placeholder="Seu nome"
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v !== (meu.nome ?? '')) void salvar(db().from('perfis').update({ nome: v || null }).eq('id', meu.id), 'Nome salvo. Vale a partir do próximo carregamento da página.');
                  }}
                />
              </label>
              <label className={u.campo}>
                <span>Cargo</span>
                <input
                  className={u.entrada}
                  key={`cargo-${meu.cargo ?? ''}`}
                  defaultValue={meu.cargo ?? ''}
                  maxLength={80}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v !== (meu.cargo ?? '')) void salvar(db().from('perfis').update({ cargo: v || null }).eq('id', meu.id));
                  }}
                />
              </label>
            </div>
            <div className={a.linha}>
              <span className={`${u.status} ${u.stLima}`}>Perfil: {nomePapel(meu.papel)}</span>
              <button type="button" className={a.btnPequeno} onClick={() => setNovaSenha(novaSenha === null ? '' : null)}>
                <KeyRound size={14} /> Alterar senha
              </button>
              <button
                type="button"
                className={a.btnPequeno}
                onClick={async () => {
                  const { error } = await db().auth.signOut({ scope: 'local' });
                  if (!error) location.replace('/login');
                  else setAviso({ texto: 'Falha ao encerrar a sessão.', erro: true });
                }}
              >
                <LogOut size={14} /> Sair da conta
              </button>
            </div>
            {novaSenha !== null && (
              <form
                className={a.linha}
                onSubmit={async (e) => {
                  e.preventDefault();
                  setOcupado(true);
                  const { error } = await db().auth.updateUser({ password: novaSenha });
                  setOcupado(false);
                  if (error) setAviso({ texto: 'Não foi possível alterar a senha. Use pelo menos 8 caracteres, diferente da atual.', erro: true });
                  else {
                    setAviso({ texto: 'Senha alterada.' });
                    setNovaSenha(null);
                  }
                }}
              >
                <label className={u.campo}>
                  <span>Nova senha (mínimo 8 caracteres)</span>
                  <input className={u.entrada} type="password" autoComplete="new-password" minLength={8} required value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} />
                </label>
                <button className={u.btnPrimario} disabled={ocupado}>
                  Salvar senha
                </button>
              </form>
            )}
          </>
        ) : (
          <p className={u.nota}>Carregando…</p>
        )}
      </div>

      {/* ---------- Pessoas ---------- */}
      <div className={a.bloco}>
        <h3>
          <Users size={16} style={{ verticalAlign: '-3px', marginRight: 6 }} />
          Pessoas e perfis de acesso
        </h3>
        <ul className={a.pessoas}>
          {lista.map((p) => {
            const pode = podeGerir(p);
            return (
              <li key={p.id} className={`${a.pessoa} ${p.ativo ? '' : a.pessoaInativa}`}>
                <span className={a.pessoaNome}>
                  <strong>
                    {p.nome || p.email}
                    {p.id === eu ? ' (você)' : ''}
                  </strong>
                  <small>
                    {p.email}
                    {p.ativo ? '' : ' · acesso desativado'}
                  </small>
                </span>
                <span className={a.pessoaNome}>
                  <small>{p.cargo || 'Cargo não informado'}</small>
                </span>
                <select
                  className={u.entrada}
                  aria-label={`Perfil de acesso de ${p.email}`}
                  value={p.papel}
                  disabled={!pode || ocupado}
                  onChange={(e) => void salvar(db().from('perfis').update({ papel: e.target.value }).eq('id', p.id), `Perfil de ${p.email} alterado para ${nomePapel(e.target.value)}.`)}
                >
                  {PAPEIS.map((x) => (
                    <option key={x.id} value={x.id} disabled={!admin && ['administrador', 'gestor'].includes(x.id)}>
                      {x.nome}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className={`${a.btnPequeno} ${p.ativo ? a.perigo : ''}`}
                  disabled={!pode || ocupado}
                  onClick={() => {
                    if (p.ativo && !window.confirm(`Desativar o acesso de ${p.email}? A pessoa deixa de entrar no workspace; os registros feitos por ela continuam.`)) return;
                    void salvar(db().from('perfis').update({ ativo: !p.ativo }).eq('id', p.id), p.ativo ? 'Acesso desativado.' : 'Acesso reativado.');
                  }}
                >
                  {p.ativo ? 'Desativar' : 'Reativar'}
                </button>
                {times.length > 0 && (
                  <span className={a.equipesDaPessoa}>
                    Equipes:
                    {times.map((t) => {
                      const dentro = membros.some((m) => m.equipe_id === t.id && m.perfil_id === p.id);
                      return (
                        <label key={t.id}>
                          <input
                            type="checkbox"
                            disabled={!gerencia || ocupado}
                            checked={dentro}
                            onChange={(e) =>
                              void salvar(
                                e.target.checked
                                  ? db().from('equipe_membros').insert({ equipe_id: t.id, perfil_id: p.id })
                                  : db().from('equipe_membros').delete().eq('equipe_id', t.id).eq('perfil_id', p.id)
                              )
                            }
                          />
                          {t.nome}
                        </label>
                      );
                    })}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        <ul className={a.papeis}>
          {PAPEIS.map((x) => (
            <li key={x.id}>
              <b>{x.nome}:</b> {x.resumo}
            </li>
          ))}
        </ul>
      </div>

      {/* ---------- Equipes ---------- */}
      <div className={a.bloco}>
        <h3>Equipes</h3>
        {times.length ? (
          <ul className={a.listaSimples}>
            {times.map((t) => {
              const n = membros.filter((m) => m.equipe_id === t.id).length;
              return (
                <li key={t.id}>
                  <span>
                    {t.nome} · {n} {n === 1 ? 'pessoa' : 'pessoas'}
                  </span>
                  {gerencia && (
                    <button
                      type="button"
                      className={`${a.btnPequeno} ${a.perigo}`}
                      disabled={ocupado}
                      onClick={() => {
                        if (window.confirm(`Excluir a equipe "${t.nome}"? As pessoas continuam no workspace.`)) void salvar(db().from('equipes').delete().eq('id', t.id), 'Equipe excluída.');
                      }}
                    >
                      Excluir
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className={u.nota}>Nenhuma equipe criada.</p>
        )}
        {gerencia && (
          <form
            className={a.linha}
            onSubmit={async (e) => {
              e.preventDefault();
              if (await salvar(db().from('equipes').insert({ nome: nomeEquipe.trim() }), 'Equipe criada.')) setNomeEquipe('');
            }}
          >
            <label className={u.campo}>
              <span>Nova equipe</span>
              <input className={u.entrada} required maxLength={80} placeholder="Ex.: Comercial" value={nomeEquipe} onChange={(e) => setNomeEquipe(e.target.value)} />
            </label>
            <button className={u.btnSecundario} disabled={ocupado}>
              Criar equipe
            </button>
          </form>
        )}
      </div>

      {/* ---------- Convites ---------- */}
      {admin && (
        <div className={a.bloco}>
          <h3>Convites</h3>
          <p className={u.nota}>
            Gere o convite, copie o link e envie à pessoa. Ela cria a senha, confirma o e-mail e entra como visualizador; depois
            ajuste o perfil acima. O link vale 7 dias e só funciona para o e-mail convidado.
          </p>
          {convites.length > 0 && (
            <ul className={a.listaSimples}>
              {convites.map((c) => (
                <li key={c.id}>
                  <span>
                    {c.email} · {new Date(c.expira_em) < new Date() ? 'expirado' : `vale até ${new Date(c.expira_em).toLocaleDateString('pt-BR')}`}
                  </span>
                  <button
                    type="button"
                    className={a.btnPequeno}
                    onClick={() =>
                      navigator.clipboard
                        .writeText(linkConvite(c.id))
                        .then(() => setAviso({ texto: `Link copiado. Envie para ${c.email}.` }))
                        .catch(() => window.prompt('Copie o link do convite:', linkConvite(c.id)))
                    }
                  >
                    Copiar link
                  </button>
                  <button type="button" className={`${a.btnPequeno} ${a.perigo}`} disabled={ocupado} onClick={() => void salvar(db().from('convites_workspace').delete().eq('id', c.id), 'Convite revogado.')}>
                    Revogar
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form
            className={a.linha}
            onSubmit={async (e) => {
              e.preventDefault();
              if (await salvar(db().from('convites_workspace').insert({ email: emailConvite.toLowerCase().trim() }), 'Convite gerado. Copie o link e envie à pessoa.')) setEmailConvite('');
            }}
          >
            <label className={u.campo}>
              <span>E-mail da pessoa</span>
              <input className={u.entrada} required type="email" placeholder="pessoa@empresa.com.br" value={emailConvite} onChange={(e) => setEmailConvite(e.target.value)} />
            </label>
            <button className={u.btnSecundario} disabled={ocupado}>
              Gerar convite
            </button>
          </form>
        </div>
      )}

      {aviso && (
        <p className={u.nota} role="status" style={{ marginTop: 14, ...(aviso.erro ? { color: '#ffb199' } : {}) }}>
          {aviso.texto}
        </p>
      )}
    </section>
  );
}
