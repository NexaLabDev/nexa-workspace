import type { TipoCampo } from './servicos-nexa';

// ============================================
// DADOS DE EXEMPLO DO NEXA WORKSPACE
// ============================================
// ⚠️ Tudo aqui é EXEMPLO, copiado dos layouts aprovados
// ("Painel Nexa Lab ao Amanhecer", "Dashboard CRM Nexa Workspace",
// "Painel CRM Nexa Workspace em Verde Lima" e "CRM de Leads").
// Nenhum cliente, valor ou documento é real. Nada é salvo ainda.
// Quando houver banco, troque estes valores pelos dados reais.
// ============================================

export const usuario = { nome: 'Luiza' };

// ---------- Painel inicial ----------
export const clima = {
  temperatura: '24°C',
  descricao: 'Céu Limpo',
  cidade: 'Betim - MG',
};

export const indicadores = {
  projetosAtivos: { valor: '18', variacao: '+28%' },
  clientes: { valor: '32', variacao: '+14%' },
  propostas: { valor: '5', variacao: '+25%' },
  faturamentoMes: { valor: 'R$ 136.000' },
};

export const agendaHoje = [
  { hora: '10:30', titulo: 'Reunião com cliente', detalhe: 'Projeto de implantação CRM', destaque: true },
  { hora: '14:00', titulo: 'Apresentação de proposta', detalhe: 'Nexa Indústria', destaque: false },
  { hora: '16:30', titulo: 'Alinhamento de contrato', detalhe: 'Renovação de serviço', destaque: false },
];

export const metaMes = {
  percentual: 68,
  atingido: 'R$ 136.000',
  meta: 'R$ 200.000',
};

export const atalhos = {
  propostasPendentes: 3,
  contratosAtivos: 7,
};

// ---------- Clientes ----------
export type StatusCliente = 'Ativo' | 'Qualificação' | 'Proposta' | 'Negociação' | 'Em andamento' | 'Fechado';

export const STATUS_CLIENTE: StatusCliente[] = [
  'Ativo',
  'Qualificação',
  'Proposta',
  'Negociação',
  'Em andamento',
  'Fechado',
];

export type HistoricoCliente = {
  /** Data e hora (ISO) */
  em: string;
  texto: string;
  /** Lead/contratação ligada ao evento */
  leadId?: string;
  /** Evita registrar o mesmo evento duas vezes (ex.: "contratacao:<leadId>") */
  chave?: string;
};

export type Cliente = {
  id: string;
  nome: string;
  segmento: string;
  status: StatusCliente;
  servicos: string[];
  ultimaAtividade: string;
  // --- Preenchidos quando o cliente nasce (ou é vinculado) por uma venda ganha ---
  nomeCompleto?: string;
  /** CPF ou CNPJ, como digitado */
  documento?: string;
  email?: string;
  telefone?: string;
  endereco?: string;
  assinante?: string;
  /** Pessoa de contato no cliente */
  contato?: string;
  origem?: 'manual' | 'venda';
  criadoEm?: string;
  historico?: HistoricoCliente[];
};

export const clientes: Cliente[] = [
  { id: 'c1', nome: 'Alpha Tech', segmento: 'Tecnologia', status: 'Ativo', servicos: ['Consultoria', 'Implantação'], ultimaAtividade: 'há 2 horas' },
  { id: 'c2', nome: 'Lumina Saúde', segmento: 'Saúde', status: 'Proposta', servicos: ['Projeto', 'Suporte'], ultimaAtividade: 'há 5 horas' },
  { id: 'c3', nome: 'Norte Construções', segmento: 'Construção', status: 'Negociação', servicos: ['Consultoria', 'Projeto'], ultimaAtividade: 'ontem' },
  { id: 'c4', nome: 'Campo Digital', segmento: 'Marketing', status: 'Ativo', servicos: ['Implantação', 'Suporte'], ultimaAtividade: 'ontem' },
  { id: 'c5', nome: 'Beta Educação', segmento: 'Educação', status: 'Qualificação', servicos: ['Projeto'], ultimaAtividade: 'há 2 dias' },
  { id: 'c6', nome: 'Viva Gestão', segmento: 'Gestão', status: 'Ativo', servicos: ['Site + SEO'], ultimaAtividade: 'Hoje, 15:24' },
  { id: 'c7', nome: 'Grupo Atlas', segmento: 'Varejo', status: 'Em andamento', servicos: ['Campanha digital'], ultimaAtividade: 'Hoje, 11:07' },
  { id: 'c8', nome: 'EcoNorte', segmento: 'Energia', status: 'Proposta', servicos: ['Rebranding'], ultimaAtividade: 'Ontem, 18:41' },
  { id: 'c9', nome: 'Núcleo Saúde', segmento: 'Saúde', status: 'Fechado', servicos: ['Identidade + Site'], ultimaAtividade: 'Ontem, 16:20' },
];

// ---------- CRM de Leads (layout "CRM de Leads") ----------
export type EtapaVenda = { id: string; nome: string; cor: string };

export type EtapaLead = {
  id: string;
  nome: string;
  /** Leads que o contador do layout soma, mas que não aparecem como cartão (exemplo) */
  ocultos: number;
};

export const etapasLead: EtapaLead[] = [
  { id: 'novo', nome: 'Novo Lead', ocultos: 5 },
  { id: 'contato', nome: 'Contato Inicial', ocultos: 3 },
  { id: 'proposta', nome: 'Proposta Enviada', ocultos: 2 },
  { id: 'negociacao', nome: 'Negociação', ocultos: 1 },
  { id: 'fechamento', nome: 'Fechamento', ocultos: 0 },
  { id: 'ganho', nome: 'Venda ganha', ocultos: 0 },
];

/** Etapa usada quando o lead é marcado como perdido (não aparece como coluna) */
export const ETAPA_PERDIDO = 'perdido';
export const ETAPA_GANHO = 'ganho';

export const ORIGENS_LEAD = ['WhatsApp', 'Instagram', 'Site', 'Indicação', 'Google', 'Outro'];

export type ComentarioLead = { texto: string; em: string };
export type TarefaLead = { id: string; texto: string; prazo?: string; feita: boolean };

/** Dados para gerar proposta e contrato (preenchidos no Fechamento) */
export type DadosCadastro = {
  nomeCompleto?: string;
  documento?: string;
  endereco?: string;
  assinante?: string;
  servico?: string;
  /** Serviço do cadastro de Serviços escolhido na lista */
  servicoId?: string;
  /** (antigo) forma de pagamento em texto — não é mais usado */
  pagamento?: string;
  prazo?: string;
};

/** Forma de pagamento */
export type FormaPagamento = 'pix' | 'boleto' | 'cartao' | 'transferencia' | 'dinheiro' | 'outro';

export type Comprovante = { nome: string; tamanho?: string; arquivoId?: string };

/**
 * Formato antigo do pagamento (até 07/11/2026: à vista, link ou entrada + parcelas num só calendário).
 * Não é mais gravado: é convertido para PagamentoLead em financeiro.ts, sem perder comprovantes.
 */
export type PagamentoLegado = {
  forma: FormaPagamento;
  condicao: string;
  parcelas: number;
  entrada?: number | null;
  primeiroVencimento: string;
  total: number;
  link?: string;
  itens: Array<{ id: string; rotulo: string; valor: number; vencimento: string; pago: boolean; pagoEm?: string; comprovante?: Comprovante }>;
};

/** Parcela do contrato (entrada + parcelas). Cada uma é independente. */
export type ParcelaContrato = {
  id: string;
  numero: number;
  /** Em reais, com centavos (editável) */
  valor: number;
  /** AAAA-MM-DD */
  vencimento: string;
  pago: boolean;
  /** AAAA-MM-DD: data efetiva do pagamento */
  pagoEm?: string;
  comprovante?: Comprovante;
};

/** Pagamento do projeto (implantação). A mensalidade fica separada, em MensalidadeLead. */
export type PagamentoLead = {
  versao: 2;
  modalidade: 'avista' | 'entrada';
  // --- À vista ---
  forma?: FormaPagamento;
  valor?: number | null;
  /** AAAA-MM-DD em que foi pago */
  pagoEm?: string;
  comprovante?: Comprovante;
  /** Observação (ex.: link de pagamento antigo, preservado na conversão) */
  observacao?: string;
  // --- Entrada + parcelas ---
  entrada?: { valor: number | null; forma: FormaPagamento; pagoEm?: string; comprovante?: Comprovante };
  qtdParcelas?: number;
  formaParcelas?: FormaPagamento;
  /** AAAA-MM-DD do vencimento da 1ª parcela */
  primeiroVencimento?: string;
  parcelas?: ParcelaContrato[];
};

/** Pagamento de um ciclo da mensalidade (só os ciclos que tiveram registro) */
export type RegistroMensalidade = {
  /** AAAA-MM */
  competencia: string;
  pago: boolean;
  pagoEm?: string;
  comprovante?: Comprovante;
  /** Valor e vencimento congelados quando o mês é registrado (reajustes não mexem nele) */
  valor?: number;
  vencimento?: string;
};

/** Valor e dia de vencimento que valem a partir de um mês (cada reajuste cria uma faixa nova). */
export type FaixaMensalidade = {
  /** AAAA-MM a partir do qual vale */
  desde: string;
  valor: number;
  dia: number;
  /** Quando o reajuste foi registrado (ISO) */
  em?: string;
};

/** Mensalidade recorrente: continua até ser pausada ou encerrada. */
export type MensalidadeLead = {
  ativa: boolean;
  valor: number | null;
  forma: FormaPagamento;
  /** Dia do vencimento mensal (1 a 31; meses curtos usam o último dia) */
  diaVencimento: number;
  /** AAAA-MM-DD */
  inicio: string;
  /** AAAA-MM-DD (opcional) */
  fim?: string;
  /** AAAA-MM-DD em que foi pausada (não gera novos ciclos depois disso) */
  pausadaEm?: string;
  descricao?: string;
  registros: RegistroMensalidade[];
  /**
   * Histórico de valores (reajustes). Sem faixas (dados antigos), vale valor/diaVencimento desde o início.
   * valor/diaVencimento acima sempre espelham a faixa mais recente.
   */
  faixas?: FaixaMensalidade[];
};

/** Arquivo ligado ao lead (anexado à mão ou gerado pelo sistema) */
export type DocumentoLead = {
  id: string;
  nome: string;
  tamanho?: string;
  tipo: 'arquivo' | 'gerado';
  origem: 'cliente' | 'equipe' | 'sistema';
  /** Chave do arquivo guardado no navegador (ver arquivos.ts) */
  arquivoId?: string;
  /** Rascunho criado no Gerador de Documentos */
  documentoId?: string;
  em: string;
};
export type HistoricoLead = { de: string; para: string; em: string };

export type Lead = {
  id: string;
  empresa: string;
  /** Sigla do avatar, como no layout */
  sigla?: string;
  descricao: string;
  /** Valor em reais; null aparece como "R$ –" */
  valor: number | null;
  /** Próximo contato (Hoje, Amanhã, 25/08…) */
  data?: string;
  /** Selo "Contrato" da coluna Fechamento */
  contrato?: boolean;
  /** Ícone de prédio antes do nome (empresa) */
  empresaPJ?: boolean;
  /** Cor do avatar, medida no layout */
  cor: string;
  etapa: string;
  origem?: string;
  responsavel?: string;
  telefone?: string;
  email?: string;
  etiquetas?: string[];
  tarefas?: TarefaLead[];
  cadastro?: DadosCadastro;
  pagamento?: PagamentoLead | PagamentoLegado;
  mensalidade?: MensalidadeLead;
  /** Informações que só existem nos documentos (entregas, validade, prazos das cláusulas…) */
  complementosDoc?: Record<string, string | undefined>;
  documentos?: DocumentoLead[];
  comentarios?: ComentarioLead[];
  historico?: HistoricoLead[];
  /** Data (AAAA-MM-DD) em que virou venda ganha */
  ganhoEm?: string;
  motivoPerda?: string;
  /** Cliente (aba Clientes) a que esta negociação pertence */
  clienteId?: string;
};

export const leads: Lead[] = [
  { id: 'l1', empresa: 'Multas BH', sigla: 'MG', descricao: 'Gestão de veículos', valor: null, data: 'Hoje', empresaPJ: true, cor: '#787878', etapa: 'novo' },
  { id: 'l2', empresa: 'Clínica Vita', descricao: 'CRM + Automação', valor: null, data: 'Hoje', cor: '#9fca33', etapa: 'novo' },
  { id: 'l3', empresa: 'AutoCenter JP', sigla: 'AC', descricao: 'Gestão de clientes', valor: null, data: 'Ontem', cor: '#777878', etapa: 'novo' },
  {
    id: 'l4',
    empresa: 'Top Multas',
    descricao: 'Portal de clientes',
    valor: 4000,
    data: 'Hoje',
    cor: '#eba51b',
    etapa: 'contato',
    responsavel: 'Luiza Paz',
    comentarios: [
      { texto: 'Interessado no sistema completo com CRM, automações e integração com Instagram.', em: new Date().toISOString() },
    ],
    tarefas: [{ id: 't1', texto: 'Enviar proposta atualizada', prazo: 'Hoje, 14:00', feita: false }],
  },
  { id: 'l5', empresa: 'Nexa Serviços', descricao: 'Gestão de projetos', valor: 8000, data: 'Amanhã', cor: '#84a44e', etapa: 'contato' },
  { id: 'l6', empresa: 'Clínica Bem Estar', descricao: 'CRM + Agendamento', valor: null, data: 'Amanhã', cor: '#747575', etapa: 'contato' },
  { id: 'l7', empresa: 'Construtora Alto', descricao: 'CRM + Processos', valor: 12000, data: 'Hoje', empresaPJ: true, cor: '#7a71a7', etapa: 'proposta' },
  { id: 'l8', empresa: 'Log Express', descricao: 'Gestão de frota', valor: 16000, data: '25/08', cor: '#809a65', etapa: 'proposta' },
  { id: 'l9', empresa: 'Consultoria Prime', descricao: 'Portal + Automação', valor: null, data: '26/08', empresaPJ: true, cor: '#757575', etapa: 'proposta' },
  { id: 'l10', empresa: 'Rede Saúde+', descricao: 'Sistema personalizado', valor: 28000, data: 'Hoje', empresaPJ: true, cor: '#eba311', etapa: 'negociacao' },
  { id: 'l11', empresa: 'MG Multas SP', sigla: 'MS', descricao: 'Gestão de unidades', valor: 18000, data: 'Amanhã', empresaPJ: true, cor: '#e98a08', etapa: 'negociacao' },
  { id: 'l12', empresa: 'Frota Minas', descricao: 'Controle de veículos', valor: null, data: '27/08', cor: '#7f9b5a', etapa: 'negociacao' },
  { id: 'l13', empresa: 'Clínica Lev', descricao: 'CRM + Automação', valor: 20000, contrato: true, cor: '#7d74ab', etapa: 'fechamento' },
  { id: 'l14', empresa: 'AutoCenter BH', descricao: 'Gestão completa', valor: 15000, contrato: true, empresaPJ: true, cor: '#98c62c', etapa: 'fechamento' },
  { id: 'l15', empresa: 'Grupo União', descricao: 'Portal + Filiais', valor: 15000, contrato: true, empresaPJ: true, cor: '#66b45b', etapa: 'fechamento' },
];

export const resumoCrm = {
  leadsAtivos: '32',
  emNegociacao: 'R$ 136.000',
  metaMes: '68%',
};

// ---------- Conversas (layout "CRM – Conversas") ----------
export type CanalConversa = 'whatsapp' | 'instagram' | 'telegram';

export type MensagemConversa = {
  id: string;
  de: 'cliente' | 'equipe';
  /** Texto da mensagem (vazio quando for só arquivo) */
  texto?: string;
  arquivo?: { nome: string; tamanho: string; exemplo?: boolean; arquivoId?: string };
  /** Data e hora (ISO) */
  em: string;
};

export type Conversa = {
  id: string;
  /** Lead do CRM ligado a esta conversa */
  leadId: string;
  canal: CanalConversa;
  naoLidas: number;
  online?: boolean;
  mensagens: MensagemConversa[];
};

function horario(diasAtras: number, h: number, m: number): string {
  const d = new Date();
  d.setDate(d.getDate() - diasAtras);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

function dataDoAno(mes: number, dia: number, h: number, m: number): string {
  const hoje = new Date();
  const d = new Date(hoje.getFullYear(), mes - 1, dia, h, m);
  if (d > hoje) d.setFullYear(d.getFullYear() - 1);
  return d.toISOString();
}

export const conversasExemplo: Conversa[] = [
  {
    id: 'cv1',
    leadId: 'l4',
    canal: 'whatsapp',
    naoLidas: 2,
    online: true,
    mensagens: [
      { id: 'm1', de: 'cliente', texto: 'Olá! Gostaria de mais informações sobre o sistema de gestão de clientes.', em: horario(0, 10, 12) },
      {
        id: 'm2',
        de: 'equipe',
        texto: 'Olá! Tudo bem?\n\nClaro! Posso te apresentar uma demonstração rápida do sistema e te enviar uma proposta personalizada, pode ser?',
        em: horario(0, 10, 15),
      },
      { id: 'm3', de: 'cliente', texto: 'Perfeito! Pode me enviar a proposta e os valores, por favor?', em: horario(0, 10, 24) },
      { id: 'm4', de: 'equipe', arquivo: { nome: 'Proposta – Top Multas.pdf', tamanho: '1,2 MB', exemplo: true }, em: horario(0, 10, 24) },
    ],
  },
  {
    id: 'cv2',
    leadId: 'l2',
    canal: 'instagram',
    naoLidas: 0,
    mensagens: [{ id: 'm1', de: 'cliente', texto: 'Vocês fazem a integração com o Instagram?', em: horario(0, 9, 57) }],
  },
  {
    id: 'cv3',
    leadId: 'l14',
    canal: 'whatsapp',
    naoLidas: 1,
    mensagens: [{ id: 'm1', de: 'cliente', texto: 'Quero entender melhor o sistema antes de decidir.', em: horario(0, 9, 21) }],
  },
  {
    id: 'cv4',
    leadId: 'l5',
    canal: 'whatsapp',
    naoLidas: 0,
    mensagens: [{ id: 'm1', de: 'cliente', texto: 'Ok, vou aguardar o retorno!', em: horario(1, 16, 40) }],
  },
  {
    id: 'cv5',
    leadId: 'l6',
    canal: 'telegram',
    naoLidas: 0,
    mensagens: [{ id: 'm1', de: 'cliente', texto: 'A proposta ficou ótima, obrigado!', em: horario(1, 11, 5) }],
  },
  {
    id: 'cv6',
    leadId: 'l8',
    canal: 'whatsapp',
    naoLidas: 0,
    mensagens: [{ id: 'm1', de: 'cliente', texto: 'Conseguimos agendar a reunião para a semana que vem.', em: dataDoAno(8, 27, 15, 30) }],
  },
];

/** Respostas prontas do botão "+" do chat (edite à vontade) */
export const respostasRapidas = [
  'Olá! Tudo bem? Como posso ajudar?',
  'Posso te enviar a proposta por aqui?',
  'Vou verificar e já te retorno.',
  'Obrigada pelo retorno! Qualquer dúvida, é só chamar.',
];


/** Iniciais do avatar no topo do CRM (como no layout) */
export const iniciaisUsuario = 'LP';

// ---------- Kanban de projetos (fases do link de acompanhamento) ----------
export type EtapaProjeto = EtapaVenda & {
  /** Texto que o cliente vê no link de acompanhamento */
  descricao: string;
  /** Progresso sugerido ao entrar na fase (pode ser ajustado no projeto) */
  progresso: number;
};

export const etapasProjeto: EtapaProjeto[] = [
  { id: 'planejamento', nome: 'Planejamento', cor: '#a8a8a8', descricao: 'Escopo definido e projeto estruturado.', progresso: 15 },
  {
    id: 'desenvolvimento',
    nome: 'Em desenvolvimento',
    cor: '#f0a24a',
    descricao: 'Seu projeto está sendo construído conforme o escopo aprovado.',
    progresso: 50,
  },
  { id: 'testes', nome: 'Em testes', cor: '#a78bfa', descricao: 'Validação e ajustes finais.', progresso: 85 },
  { id: 'concluido', nome: 'Concluído', cor: '#c4f03a', descricao: 'Projeto finalizado e pronto para uso.', progresso: 100 },
];

export type Projeto = {
  id: string;
  cliente: string;
  /** Nome do projeto/serviço (aparece no link do cliente) */
  servico: string;
  etapa: string;
  /** 0 a 100 */
  progresso: number;
  /** Data e hora (ISO) da última mudança */
  atualizadoEm: string;
  // --- Preenchidos quando o projeto nasce de uma venda ganha ---
  leadId?: string;
  conversaId?: string;
  descricao?: string;
  valor?: number | null;
  telefone?: string;
  email?: string;
  cadastro?: DadosCadastro;
  pagamento?: PagamentoLead | PagamentoLegado;
  mensalidade?: MensalidadeLead;
  documentos?: DocumentoLead[];
  anotacoes?: ComentarioLead[];
  tarefas?: TarefaLead[];
  /** Data (ISO) em que a venda foi ganha */
  vendidoEm?: string;
  /** Cliente (aba Clientes) dono do projeto */
  clienteId?: string;
  /** Código aleatório do link permanente de acompanhamento (não revela nada do projeto) */
  codigoPublico?: string;
  /** Observação que a equipe autorizou mostrar no link do cliente */
  observacaoPublica?: string;
  // --- Janela do projeto (gestão interna; nada disso vai para o link do cliente) ---
  /** Identificador interno legível (ex.: PRJ-0007) */
  codigo?: string;
  /** Responsável interno na Nexa Lab */
  responsavel?: string;
  etiquetas?: string[];
  /** AAAA-MM-DD */
  inicio?: string;
  /** AAAA-MM-DD */
  prazoEntrega?: string;
  prioridade?: PrioridadeProjeto;
  /** Linha do tempo: só recebe registros novos (nada é editado ou apagado) */
  atividades?: AtividadeProjeto[];
  /** Serviços contratados neste projeto (um principal + adicionais) */
  servicos?: ServicoProjeto[];
  /** Escopo contratado (o que entra e o que não entra) */
  escopo?: string;
  /** Observações internas (o cliente não vê) */
  observacoesInternas?: string;
  /** Outras pessoas da equipe no projeto, além do responsável */
  equipe?: string[];
  /** AAAA-MM-DD em que entrou na última fase (concluído) */
  concluidoEm?: string;
  /** Tarefas do projeto (aba Tarefas). As "tarefas" antigas acima são da negociação no CRM. */
  tarefasProjeto?: TarefaProjeto[];
  /** Como o progresso é calculado: pela fase do Kanban (padrão) ou pelas tarefas concluídas */
  modoProgresso?: 'fase' | 'tarefas';
  /** Biblioteca de arquivos do projeto (aba Anexos). Anexos de tarefas apontam para cá. */
  arquivos?: ArquivoProjeto[];
};

/**
 * Onde o conteúdo está guardado. Hoje: só no navegador (IndexedDB).
 * Preparado para o Supabase Storage em bucket PRIVADO (acesso por URL assinada e regras de acesso),
 * sem mudar os metadados: basta trocar o "tipo" quando o arquivo for enviado.
 */
export type ArmazenamentoArquivo = { tipo: 'navegador' } | { tipo: 'supabase'; bucket: string; caminho: string };

export type VersaoArquivo = {
  numero: number;
  /** Chave do conteúdo (no navegador: IndexedDB). Várias versões/entradas podem apontar para o mesmo conteúdo. */
  arquivoId: string;
  nomeOriginal: string;
  /** Tipo informado pelo navegador (só informativo: a pré-visualização confere o conteúdo) */
  tipo?: string;
  /** Bytes */
  tamanho?: number;
  /** Tamanho em texto (anexos antigos, de antes da biblioteca) */
  tamanhoTexto?: string;
  /** SHA-256 do conteúdo: detecta duplicidade real (não pelo nome) */
  hash?: string;
  em: string;
  autor?: AutorRegistro;
  /** Ex.: "alterações solicitadas", "layout aprovado" */
  nota?: string;
  /** Ausente = navegador */
  armazenamento?: ArmazenamentoArquivo;
};

/** Arquivo da biblioteca do projeto. A versão atual é a última da lista; as anteriores ficam no histórico. */
export type ArquivoProjeto = {
  id: string;
  /** Nome exibido (pode ser renomeado sem mexer no arquivo) */
  nome: string;
  /** id da categoria (aba Anexos → Categorias) */
  categoria: string;
  versoes: VersaoArquivo[];
  /** Tarefas que usam este arquivo (o mesmo arquivo pode estar em várias) */
  tarefas?: string[];
  criadoEm: string;
};

export type CategoriaArquivo = { id: string; nome: string };

export type SituacaoTarefa = 'pendente' | 'andamento' | 'bloqueada' | 'concluida';

export type SubtarefaProjeto = {
  id: string;
  texto: string;
  feita: boolean;
  /** Obrigatória: concluir a tarefa com ela pendente pede confirmação */
  obrigatoria: boolean;
  /** Data e hora (ISO) */
  concluidaEm?: string;
};

/** Vínculo de um arquivo com a tarefa. O arquivo em si mora na biblioteca do projeto (arquivoProjetoId). */
export type AnexoTarefa = {
  id: string;
  nome: string;
  tamanho?: string;
  /** Conteúdo na época do vínculo (compatibilidade com anexos antigos) */
  arquivoId: string;
  em: string;
  autor: AutorRegistro;
  /** Entrada da biblioteca (aba Anexos). Anexos antigos ganham na primeira carga. */
  arquivoProjetoId?: string;
};
export type ComentarioTarefa = { id: string; texto: string; em: string; autor: AutorRegistro };

export type TarefaProjeto = {
  id: string;
  titulo: string;
  descricao?: string;
  responsavel?: string;
  /** AAAA-MM-DD */
  prazo?: string;
  prioridade?: PrioridadeProjeto;
  situacao: SituacaoTarefa;
  /** Serviço do projeto a que pertence (sem = tarefa geral) */
  servicoProjetoId?: string;
  /** Serviço do cadastro e nome na época: a tarefa continua identificável se o serviço sair do projeto/cadastro */
  servicoId?: string;
  servicoNome?: string;
  subtarefas?: SubtarefaProjeto[];
  anexos?: AnexoTarefa[];
  comentarios?: ComentarioTarefa[];
  /** Data e hora (ISO) da conclusão */
  concluidaEm?: string;
  criadaEm: string;
  criadaPor?: AutorRegistro;
  /** Veio de um item do checklist do serviço (evita copiar o mesmo item duas vezes) */
  origem?: { checklistItemId: string };
};

/** Valor de um campo personalizado. Guarda o nome e o tipo da época, para nunca perder o significado. */
export type ValorCampo = { valor: string | boolean; rotulo: string; tipo: TipoCampo };

/** Serviço vinculado ao projeto. Cada um guarda as próprias informações. */
export type ServicoProjeto = {
  id: string;
  /** Serviço do cadastro (aba Serviços). Sem ele, vale só o nome guardado. */
  servicoId?: string;
  /** Nome no momento do vínculo (usado se o serviço sair do cadastro) */
  nome: string;
  principal: boolean;
  observacao?: string;
  /** Valores dos campos personalizados, por id do campo */
  valores?: Record<string, ValorCampo>;
  /** Cópia do checklist padrão do serviço (mudanças no modelo não alteram esta cópia) */
  checklist?: {
    copiadoEm: string;
    itens: Array<{ id: string; texto: string }>;
    /** Os itens já viraram tarefas (feito uma vez só; apagar uma tarefa não a recria) */
    tarefasCriadas?: boolean;
  };
  adicionadoEm: string;
};

export type PrioridadeProjeto = 'baixa' | 'media' | 'alta' | 'urgente';

/**
 * Quem fez o registro. Enquanto não há login, vale o nome configurado no Workspace,
 * marcado como NÃO autenticado. Com o login, os novos registros levam o id real;
 * os antigos continuam como estão (não são reatribuídos a ninguém).
 */
export type AutorRegistro =
  | { nome: string; autenticado: false }
  | { nome: string; autenticado: true; usuarioId: string };

export type TipoAtividade = 'fase' | 'dado' | 'responsavel' | 'tarefa' | 'arquivo' | 'documento' | 'comentario';

export type AtividadeProjeto = {
  id: string;
  /** Data e hora (ISO) */
  em: string;
  tipo: TipoAtividade;
  texto: string;
  autor: AutorRegistro;
};

const ATUALIZADO_EXEMPLO = new Date().toISOString();

export const projetos: Projeto[] = [
  { id: 'p1', cliente: 'Studio Vértice', servico: 'Identidade visual', etapa: 'planejamento', progresso: 15, atualizadoEm: ATUALIZADO_EXEMPLO },
  { id: 'p2', cliente: 'Clínica BelaVida', servico: 'Site institucional', etapa: 'planejamento', progresso: 15, atualizadoEm: ATUALIZADO_EXEMPLO },
  { id: 'p3', cliente: 'Grupo Atlas', servico: 'Sistema de Gestão', etapa: 'desenvolvimento', progresso: 70, atualizadoEm: ATUALIZADO_EXEMPLO },
  { id: 'p4', cliente: 'Lumen Energia', servico: 'Materiais institucionais', etapa: 'desenvolvimento', progresso: 50, atualizadoEm: ATUALIZADO_EXEMPLO },
  { id: 'p5', cliente: 'EcoNorte', servico: 'Rebranding', etapa: 'testes', progresso: 85, atualizadoEm: ATUALIZADO_EXEMPLO },
  { id: 'p6', cliente: 'Mercatto', servico: 'E-commerce', etapa: 'testes', progresso: 85, atualizadoEm: ATUALIZADO_EXEMPLO },
  { id: 'p7', cliente: 'Viva Gestão', servico: 'Site + SEO', etapa: 'concluido', progresso: 100, atualizadoEm: ATUALIZADO_EXEMPLO },
  { id: 'p8', cliente: 'Núcleo Saúde', servico: 'Identidade + Site', etapa: 'concluido', progresso: 100, atualizadoEm: ATUALIZADO_EXEMPLO },
];

// ---------- Meta mensal (layout "Meta Mensal") ----------
export type Venda = {
  id: string;
  cliente: string;
  valor: number;
  /** AAAA-MM-DD */
  data: string;
  /** Lead do CRM que gerou a venda (vendas de exemplo não têm) */
  leadId?: string;
  /** Cliente (aba Clientes) da venda */
  clienteId?: string;
  /** Serviço contratado */
  servico?: string;
};

export type DiasTrabalho = 'seg-sex' | 'seg-sab' | 'todos';

function dataLocal(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${dia}`;
}

export function mesChave(d: Date): string {
  return dataLocal(d).slice(0, 7);
}

/**
 * Vendas de exemplo do mês atual, com os números do layout:
 * 12 vendas, R$ 34.200 no total (ticket médio R$ 2.850) e R$ 1.200 hoje.
 */
function gerarVendasExemplo(): Venda[] {
  const hoje = new Date();
  const valores = [1200, 4000, 2500, 3100, 2800, 1900, 3500, 2600, 4200, 2700, 3200, 2500];
  const nomes = ['Alpha Tech', 'Campo Digital', 'Viva Gestão', 'Lumina Saúde', 'Norte Construções', 'Beta Educação'];
  const diasAntes = Math.max(1, hoje.getDate() - 1);
  return valores.map((valor, i) => {
    const dia = i === 0 || hoje.getDate() === 1 ? hoje.getDate() : 1 + ((i - 1) % diasAntes);
    const d = new Date(hoje.getFullYear(), hoje.getMonth(), dia);
    return { id: `v-ex-${i + 1}`, cliente: nomes[i % nomes.length], valor, data: dataLocal(d) };
  });
}

export const vendasExemplo: Venda[] = gerarVendasExemplo();

/** Meta de exemplo do mês atual (R$ 50.000, como no layout) */
export const metasExemplo: Record<string, number> = { [mesChave(new Date())]: 50000 };

export const diasTrabalhoPadrao: DiasTrabalho = 'seg-sex';

export { dataLocal };

// ---------- Documentos ----------
export type TipoDocumento = 'Proposta' | 'Contrato' | 'Escopo' | 'Ordem de serviço' | 'Recibo' | 'Ficha de dados';
export type SituacaoDocumento = 'Enviada' | 'Em revisão' | 'Assinado';

export type Documento = {
  id: string;
  titulo: string;
  tipo: TipoDocumento;
  descricao: string;
  /** Só preenchido quando aparece no layout */
  situacao?: SituacaoDocumento;
  atualizado?: string;
  /** Lead de origem (documentos gerados no lead) */
  leadId?: string;
  /** Arquivo do documento gerado (guardado no navegador) */
  arquivoId?: string;
  /** Versão do documento para o mesmo lead e tipo (1, 2, 3…) */
  versao?: number;
  /** Data e hora (ISO) em que foi gerado */
  criadoEm?: string;
};

export const documentos: Documento[] = [
  { id: 'd1', titulo: 'Proposta – Alpha Tech', tipo: 'Proposta', descricao: 'Proposta comercial', atualizado: 'há 2 horas' },
  { id: 'd2', titulo: 'Proposta – Grupo Atlas', tipo: 'Proposta', descricao: 'Proposta comercial • v1.2', situacao: 'Enviada' },
  { id: 'd3', titulo: 'Proposta – EcoNorte', tipo: 'Proposta', descricao: 'Proposta comercial • v1.1', situacao: 'Em revisão' },
  { id: 'd4', titulo: 'Contrato – Campo Digital', tipo: 'Contrato', descricao: 'Contrato de serviços', atualizado: 'ontem' },
  { id: 'd5', titulo: 'Contrato – Viva Gestão', tipo: 'Contrato', descricao: 'Contrato de prestação • v1.0', situacao: 'Assinado' },
  { id: 'd6', titulo: 'Escopo – Lumina Saúde', tipo: 'Escopo', descricao: 'Escopo do projeto', atualizado: 'há 2 dias' },
];
