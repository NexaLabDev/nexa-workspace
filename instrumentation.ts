// O agendador de avisos por push lia os dados do arquivo local (.dados). Com os dados no
// Supabase ele ficaria trabalhando sobre informação antiga, então está desligado.
// Os avisos de cobrança aparecem na central (sininho), calculados dos dados sincronizados.
// Pendência registrada: push agendado lendo do Supabase (precisa de um serviço agendado).
export async function register() {}
