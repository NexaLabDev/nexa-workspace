// Executado uma vez quando o servidor do Next inicia: liga o agendador de avisos de vencimento.
// O "if" no formato abaixo é o recomendado pelo Next: assim o código de Node fica fora do pacote "edge".
export async function register() {
  // Online (Vercel) o servidor não guarda arquivos nem fica ligado: o agendador só roda no computador local.
  if (process.env.VERCEL) return;
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { iniciarAgendador } = await import('./lib/servidor/agendador');
    iniciarAgendador();
  }
}
