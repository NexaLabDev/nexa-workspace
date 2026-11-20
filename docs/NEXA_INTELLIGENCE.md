# Nexa Intelligence — versão interna

**Acesso:** /intelligence (somente administradores do workspace). O recurso usa o login Supabase existente.

## Módulos
- **Precificar:** calcula preços sugeridos de implantação e mensalidade com valor-hora, gastos diretos, rateio de despesas fixas, reserva tributária, taxas e margem-alvo. Também compara preço informado.
- **Meus custos:** edita parâmetros e despesas mensais; salva no Supabase por workspace.
- **Atendimento:** seleciona conversas do CRM ou carrega manualmente as mensagens textuais da ZapClaw. O operador revisa e anonimiza o texto, confirma a autorização, e só então solicita análise. **Não há leitura nem envio automático ao modelo.**
- **Consultar IA:** tira dúvidas de precificação e estratégias, usando parâmetros e orçamento atual.
- **Histórico:** salva versões dos orçamentos e permite recuperá-las. Ao recuperar, valores são recalculados com custos atuais.

## Implantação
1. Execute a migration supabase/migrations/20261120153000_nexa_intelligence.sql no Supabase (já aplicada no projeto de produção na entrega inicial).
2. Na Vercel, em Settings > Environment Variables, cadastre OPENAI_API_KEY como segredo do servidor em Production (e Preview para testes). Nunca coloque em NEXT_PUBLIC_ ou no código.
3. Opcional: OPENAI_MODEL=gpt-6-luna para alterar modelo.
4. Refaça o deploy após configurar a variável. A conta OpenAI API precisa de créditos ou faturamento configurados.
5. Preencha custos reais antes de usar preços sugeridos em propostas. Valor zero representa dado ainda não informado.

**Importante:** a Vercel não tinha OPENAI_API_KEY cadastrada durante o desenvolvimento. Sem ela, precificação, registro de custos e histórico funcionam; botões de IA mostram configuração pendente.

## Cálculo
- rateioImplantacao = custosFixos * percentualImplantacao / projetosPorMes
- rateioMensal = custosFixos * (1 - percentualImplantacao) / clientesAtivos
- custoImplantacao = horasImplantacao * valorHora + despesasUnicas + rateioImplantacao
- custoMensal = horasSuporte * valorHora + despesasMensais + rateioMensal
- preco = custo / (1 - (aliquota + taxaPagamento + margem)/100)

A margem é sobre a receita bruta. Se percentuais somarem 100% ou mais, não se calcula preço. Rateio é limitado a 0–100%. Alterar parâmetros não sobrescreve valores anteriores salvos.

## Privacidade e segurança
- Tabelas de custos e projetos usam RLS forçado e políticas restritas a administradores da mesma organização.
- A rota /api/intelligence/analisar valida login, papel, origem e tamanho do pedido.
- Respostas da OpenAI usam Responses API com store:false; conversas brutas e análises não são persistidas no banco.
- Dados pessoais comuns podem ser mascarados antes de enviar; revisão e base legal adequada continuam necessárias.
- A IA não envia mensagens aos clientes e não promete resultados.
- Limite de chamadas por instância não substitui limite distribuído, orçamento por organização e auditoria; são necessários antes de revenda.
- Antes de vender como SaaS, desenvolver cotas de tokens, consentimento, logs adequados, cobrança e governança de dados.
