'use client';

// Configurações → Backup e importação (só administrador).
// - Backup do workspace: baixa os registros e os anexos que estão no Supabase.
// - Importação dos dados antigos deste navegador (ou de um arquivo de backup):
//   1) examina e mostra a prévia; 2) baixa um backup local; 3) só importa com confirmação.
//   Entra apenas o que ainda não existe no workspace (mesmo ID com conteúdo diferente
//   interrompe a importação). Os dados do navegador não são apagados.

import { useState } from 'react';
import { DatabaseBackup, Download, Search, Upload } from 'lucide-react';
import { montarBackup, baixarBackup, baixarBackupNuvem, lerBackup, type Backup } from '@/components/nexa/backup';
import { subirPrivado } from '@/components/nexa/storage';
import { idsDeArquivoEmUso } from '@/components/nexa/arquivos';
import { identidade, importar } from '@/components/nexa/remoto';
import { clientes, leads, projetos, documentos, conversasExemplo, vendasExemplo } from '@/components/nexa/dados-exemplo';
import u from '@/components/nexa/ui.module.css';
import a from './acesso.module.css';

/** IDs dos registros de demonstração: ficam fora da importação, a menos que a pessoa marque para incluir */
const exemplos: Record<string, Set<string>> = Object.fromEntries(
  Object.entries({ clientes, leads, projetos, documentos, conversas: conversasExemplo, vendas: vendasExemplo }).map(([k, v]) => [k, new Set(v.map((x) => x.id))])
);

const NOMES: Record<string, string> = {
  leads: 'Leads',
  clientes: 'Clientes',
  vendas: 'Vendas',
  projetos: 'Projetos',
  documentos: 'Documentos',
  conversas: 'Conversas',
  servicos: 'Serviços',
  metas: 'Metas',
  prestadora: 'Dados da prestadora',
  preferencias: 'Preferências',
  'dias-trabalho': 'Dias de trabalho',
  'categorias-arquivos': 'Categorias de arquivos',
};

export default function Importar() {
  const [b, setB] = useState<Backup | null>(null);
  const [aviso, setAviso] = useState<{ texto: string; erro?: boolean } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [incluir, setIncluir] = useState(false);
  if (identidade()?.papel !== 'administrador') return null;

  const dados: Record<string, unknown> = {};
  let demonstracao = 0;
  for (const [c, v] of Object.entries(b?.dados ?? {})) {
    if (c === 'perfil') continue;
    dados[c] = Array.isArray(v)
      ? v.filter((r) => {
          if (exemplos[c]?.has(r.id)) {
            demonstracao++;
            return incluir;
          }
          return true;
        })
      : v;
  }

  const executar = async (f: () => Promise<void>) => {
    setOcupado(true);
    setAviso(null);
    try {
      await f();
    } catch (e) {
      setAviso({ texto: (e as Error).message, erro: true });
    } finally {
      setOcupado(false);
    }
  };

  return (
    <section className={u.painel} id="backup">
      <header className={u.painelTopo}>
        <DatabaseBackup size={28} strokeWidth={1.7} />
        <div>
          <h2>Backup e importação</h2>
          <small>Os arquivos de backup contêm informações privadas de clientes. Guarde-os em local seguro.</small>
        </div>
      </header>

      <div className={a.bloco}>
        <h3>Backup do workspace</h3>
        <div className={a.linha}>
          <button
            type="button"
            className={u.btnPrimario}
            disabled={ocupado}
            onClick={() =>
              void executar(async () => {
                const r = await baixarBackupNuvem();
                setAviso({ texto: `Backup do workspace baixado: ${r.listas} listas e ${r.arquivos} anexos.` });
              })
            }
          >
            <Download size={17} /> Baixar backup do workspace
          </button>
        </div>
        <p className={u.nota}>Cópia dos registros e anexos que estão no Supabase (até 50 MB de anexos por arquivo).</p>
      </div>

      <div className={a.bloco}>
        <h3>Importar dados antigos</h3>
        <p className={u.nota}>
          Para trazer o que estava salvo neste navegador antes do login (ou um arquivo de backup). Nada é importado sem a sua
          confirmação, nada do workspace é sobrescrito e os dados do navegador continuam onde estão.
        </p>
        <div className={a.linha}>
          <button type="button" className={u.btnSecundario} disabled={ocupado} onClick={() => void executar(async () => setB(await montarBackup()))}>
            <Search size={17} /> Examinar este navegador
          </button>
          <label className={u.btnSecundario} style={{ cursor: ocupado ? 'not-allowed' : 'pointer' }}>
            <Upload size={17} /> Abrir arquivo de backup
            <input
              type="file"
              accept="application/json,.json"
              hidden
              disabled={ocupado}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) void executar(async () => setB(await lerBackup(f)));
              }}
            />
          </label>
        </div>

        {b && (
          <>
            <ul className={a.previa} aria-label="Prévia da importação">
              {Object.entries(dados).map(([c, v]) => (
                <li key={c}>
                  {NOMES[c] ?? c}: {Array.isArray(v) ? `${v.length} registro(s)` : 'configuração'}
                </li>
              ))}
              <li>Anexos no backup: {b.arquivos.length}</li>
              {!Object.keys(dados).length && <li>Nenhum dado encontrado.</li>}
            </ul>
            {demonstracao > 0 && (
              <label className={a.marcar}>
                <input type="checkbox" checked={incluir} onChange={(e) => setIncluir(e.target.checked)} />
                Incluir {demonstracao} registro(s) de demonstração (marque só se você editou esses registros e quer mantê-los)
              </label>
            )}
            <div className={a.linha}>
              <button
                type="button"
                className={u.btnSecundario}
                disabled={ocupado}
                onClick={() =>
                  void executar(async () => {
                    await baixarBackup();
                    setAviso({ texto: 'Backup dos dados deste navegador baixado.' });
                  })
                }
              >
                <Download size={17} /> Baixar backup deste navegador
              </button>
              <button
                type="button"
                className={u.btnPrimario}
                disabled={ocupado}
                onClick={() =>
                  void executar(async () => {
                    if (!window.confirm('Importar os registros da prévia para o workspace? Só entra o que ainda não existe; os dados deste navegador são preservados.')) return;
                    const faltam = idsDeArquivoEmUso(dados);
                    for (const arq of b.arquivos) faltam.delete(arq.id);
                    if (faltam.size) throw Error('Backup incompleto: falta o anexo ' + [...faltam][0] + '. Nada foi importado.');
                    for (const arq of b.arquivos) {
                      const bytes = Uint8Array.from(atob(arq.base64), (ch) => ch.charCodeAt(0));
                      await subirPrivado(arq.id, new Blob([bytes]), true);
                    }
                    const n = await importar(dados);
                    setAviso({ texto: `${n} registro(s) novo(s) importado(s) e conferido(s).` });
                    setB(null);
                  })
                }
              >
                Confirmar importação
              </button>
            </div>
          </>
        )}
      </div>

      {(ocupado || aviso) && (
        <p className={u.nota} role="status" style={{ marginTop: 14, ...(aviso?.erro ? { color: '#ffb199' } : {}) }}>
          {ocupado ? 'Processando…' : aviso?.texto}
        </p>
      )}
    </section>
  );
}
