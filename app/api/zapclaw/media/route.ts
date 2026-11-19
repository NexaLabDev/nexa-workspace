import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { configPublica } from '@/lib/supabase/config';
import { configuracaoZapclaw, normalizarMensagem, requisicaoZapclaw } from '@/lib/servidor/zapclaw';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const ID_MIDIA = /^wa-[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
type Tipo = 'image' | 'video' | 'audio';
const MIME_POR_TIPO: Record<Tipo, readonly string[]> = {
  image: ['image/jpeg','image/png'],
  video: ['video/mp4'],
  audio: ['audio/mpeg','audio/mp4','audio/ogg','audio/aac','audio/amr'],
};
const NOME_POR_MIME: Record<string, string> = {
  'image/jpeg':'foto.jpg','image/png':'foto.png',
  'video/mp4':'video.mp4',
  'audio/mpeg':'audio.mp3','audio/mp4':'audio.m4a',
  'audio/ogg':'audio.ogg','audio/aac':'audio.aac','audio/amr':'audio.amr',
};

const headers = { 'Cache-Control': 'private, no-store' };
function erro(msg: string, status: number) {
  return NextResponse.json({ erro: msg }, { status, headers });
}
export async function POST(req: Request) {
  if (Number(req.headers.get('content-length') ?? '0') > 4500) return erro('Dados inválidos.', 413);
  let entrada: unknown;
  try { entrada = await req.json(); } catch { return erro('Dados inválidos.', 400); }
  if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) return erro('Dados inválidos.', 400);
  const d = entrada as Record<string, unknown>;
  const to = typeof d.to === 'string' ? d.to.replace(/\D/g, '') : '';
  const arquivoId = typeof d.arquivoId === 'string' ? d.arquivoId : '';
  const tipo = d.tipo;
  const legenda = typeof d.legenda === 'string' ? d.legenda.trim() : '';
  const idempotencyKey = typeof d.idempotencyKey === 'string' ? d.idempotencyKey : '';
  if (!/^\d{10,15}$/.test(to) || !ID_MIDIA.test(arquivoId) ||
      (tipo !== 'image' && tipo !== 'video' && tipo !== 'audio') ||
      !UUID.test(idempotencyKey) || legenda.length > 1024 ||
      (tipo === 'audio' && legenda)) return erro('Tipo, contato ou arquivo inválido.', 400);

  // A verificação é feita no servidor, por usuário autenticado e workspace.
  // NUNCA aceitamos um caminho arbitrário de Storage enviado pelo navegador.
  const { url, chavePublica } = configPublica();
  const cookieStore = cookies();
  const db = createServerClient(url, chavePublica, {
    cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} },
  });
  const { data: { user }, error: authError } = await db.auth.getUser();
  if (authError || !user) return erro('Faça login no Workspace.', 401);
  const { data: perfil, error: perfilError } = await db.from('perfis')
    .select('workspace_id,papel,ativo').eq('id',user.id).maybeSingle();
  if (perfilError || !perfil || !perfil.ativo ||
      !['administrador','gestor','colaborador'].includes(String(perfil.papel)) ||
      typeof perfil.workspace_id !== 'string') return erro('Sem permissão para enviar mensagens.',403);

  const config = await configuracaoZapclaw();
  if (!config) return erro('A conexão do WhatsApp precisa ser configurada.',503);

  try {
    // Somente respostas manuais dentro da janela de atendimento.
    // Não dispara mensagens de template (que poderiam ser tarifadas).
    const desde = new Date(Date.now()-24*60*60*1000).toISOString();
    const recentes = await requisicaoZapclaw('/send/messages',config.chave,{
      params: new URLSearchParams({from:config.numero,direction:'inbound',since:desde,limit:'100'}),
    });
    if (!recentes.ok || !Array.isArray(recentes.dados.messages)) {
      return erro('Não foi possível confirmar a janela de atendimento. Nada foi enviado.',503);
    }
    const contatoAtivo = recentes.dados.messages
      .map((m) => normalizarMensagem(m))
      .some((m) => m?.direction === 'inbound' && m.to === to);
    if (!contatoAtivo) return erro('Para enviar, o contato precisa ter escrito nas últimas 24 horas.',403);

    const path = perfil.workspace_id + '/' + arquivoId;
    const { data: blob, error: storageError } = await db.storage.from('nexa-arquivos').download(path);
    if (storageError || !blob) return erro('Arquivo não encontrado no armazenamento privado.',404);
    const mime = blob.type.split(';')[0].trim().toLowerCase();
    if (!MIME_POR_TIPO[tipo].includes(mime)) return erro('Formato não aceito. Envie JPG, PNG, MP4, MP3, M4A ou OGG.',415);
    if (blob.size < 1 || blob.size > (tipo === 'image' ? 5 : 16)*1024*1024) {
      return erro('Arquivo excede o limite do WhatsApp.',413);
    }

    // Upload servidor -> ZapClaw -> Meta. A chave nunca sai do servidor.
    const form = new FormData();
    form.set('from',config.numero);
    form.set('file',blob,NOME_POR_MIME[mime]);
    const upload = await fetch('https://api.zapclaw.app/api/v1/media', {
      method:'POST',headers:{'X-API-Key':config.chave},
      body:form,cache:'no-store',signal:AbortSignal.timeout(35000),
    });
    const retorno: unknown = await upload.json().catch(() => null);
    const item = retorno && typeof retorno === 'object' && !Array.isArray(retorno)
      ? retorno as Record<string, unknown> : {};
    const mediaId = typeof item.media_id === 'string' ? item.media_id : '';
    if (!upload.ok || !mediaId) {
      return erro(upload.status === 413 ? 'Arquivo muito grande para a Meta.' :
        'A ZapClaw não aceitou esse arquivo. Confira o formato e tente novamente.',502);
    }

    const corpo: Record<string,string> = {from:config.numero,to,type:tipo,mediaId};
    if (legenda && tipo !== 'audio') corpo.caption = legenda;
    const enviado = await requisicaoZapclaw('/send/media',config.chave,{
      corpo,idempotencyKey,
    });
    if (!enviado.ok) {
      return erro(enviado.status === 402 ? 'Limite ou cobrança pendente na ZapClaw.' :
        enviado.status === 429 ? 'Limite temporário de envio atingido.' :
        'A ZapClaw não confirmou o envio desta mídia (HTTP ' + enviado.status + ').',502);
    }
    return NextResponse.json({
      enviado:enviado.status === 201,
      indeterminado:enviado.status === 202,
      aviso: enviado.status === 202
        ? 'A Meta não confirmou se entregou. Verifique no WhatsApp antes de repetir.'
        : undefined,
    },{headers});
  } catch {
    return erro('Não foi possível confirmar o envio. Verifique no WhatsApp antes de tentar de novo.',502);
  }
}
