/** Exercita backup + restauração de tombstone e anexo via API real (Supabase Docker local). */
import { createClient } from '@supabase/supabase-js';
import { randomUUID, createHash } from 'node:crypto';

const endereco = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54621';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(endereco)) {
  throw Error('Este teste nunca pode acessar um Supabase remoto.');
}
const chave = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!chave) throw Error('Falta a chave anon do Supabase local.');

const db = createClient(endereco, chave, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const login = await db.auth.signInWithPassword({
  email: 'admin@teste.local', password: 'TesteAdmin!123',
});
if (login.error || !login.data.user) throw Error('Login local de admin falhou.');
const usuario = login.data.user.id;
const { data: workspace, error: eWs } = await db.rpc('workspace_id_atual');
if (eWs || !workspace) throw Error('Workspace fictício não encontrado.');

const id = `backup-${randomUUID().slice(0, 10)}`;
const anexoId = `arq-${randomUUID()}`;
const conteudo = Uint8Array.from([10, 20, 30, 40, 50, 60, 70]);
const arquivo = new Blob([conteudo], { type: 'application/octet-stream' });
const hash = (x) => createHash('sha256').update(x).digest('hex');
const storage = db.storage.from('nexa-arquivos');
const caminho = `${workspace}/${anexoId}`;
const subida = await storage.upload(caminho, arquivo, {
  contentType: 'application/octet-stream', upsert: false,
});
if (subida.error) throw Error('Falha ao subir anexo fictício: ' + subida.error.message);
const baixado = await storage.download(caminho);
if (baixado.error || !baixado.data) throw Error('Falha ao baixar anexo fictício.');
if (hash(new Uint8Array(await baixado.data.arrayBuffer())) !== hash(conteudo)) {
  throw Error('Anexo restaurado não é idêntico ao original.');
}
const lead = { id, empresa: 'Backup Isolado', etapa: 'novo', arquivoId: anexoId };
async function gravar(registro) {
  const { error } = await db.rpc('gravar_registros', {
    p_workspace: workspace, p_usuario: usuario, p_mudancas: [registro],
  });
  return error;
}
async function ler() {
  const { data, error } = await db.rpc('ler_registros');
  if (error) throw Error('Falha ao consultar registros: ' + error.message);
  return data.find(r => r.colecao === 'leads' && r.id === id);
}
const inicial = { colecao: 'leads', id, ordem: 0, versao: 0, conteudo: lead };
if (await gravar(inicial)) throw Error('Falha ao criar lead fictício.');
const salvo = await ler();
if (!salvo || salvo.versao !== 1 || salvo.conteudo.arquivoId !== anexoId) {
  throw Error('Lead inicial não persistiu.');
}
if (await gravar({ ...inicial, versao: 1, conteudo: null })) {
  throw Error('Falha ao excluir lead fictício.');
}
const excluido = await ler();
if (excluido?.conteudo !== null || excluido.versao !== 2) {
  throw Error('Exclusão lógica não persistiu.');
}
if (await gravar({ ...inicial, versao: excluido.versao })) {
  throw Error('Falha ao recuperar lead excluído pela sua versão atual.');
}
const restaurado = await ler();
if (restaurado?.versao !== 3 || restaurado.conteudo?.empresa !== lead.empresa) {
  throw Error('Restauração da versão excluída não persistiu.');
}
const conflito = await gravar({ ...inicial, versao: 2, conteudo: { ...lead, empresa: 'Errado' } });
if (!conflito || conflito.code !== '40001') {
  throw Error('A tentativa com versão desatualizada não foi bloqueada.');
}
if ((await ler()).conteudo.empresa !== lead.empresa) {
  throw Error('Tentativa conflitante sobrescreveu dados.');
}
console.log('OK backup_restore_local: arquivo SHA, tombstone e conflito protegidos.');
