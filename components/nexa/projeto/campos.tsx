'use client';

// Campos editáveis direto na janela do projeto, com salvamento automático.
// Texto: grava após uma pausa na digitação e ao sair do campo.
// Data, lista e caixa de marcar: gravam na hora. O registro na linha do tempo
// acontece uma vez, ao terminar a edição (não a cada pausa).
// Destino: o projeto (padrão) ou o cadastro do cliente (aplicarCliente).

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Pencil, Plus, X } from 'lucide-react';
import j from './janela.module.css';
import { useJanela, type Transformar, type TransformarCliente } from './salvamento';
import type { TipoAtividade } from '../dados-exemplo';

const PAUSA_MS = 800;

type Registro = { tipo: TipoAtividade; texto: (antes: string, depois: string) => string };

type Destino =
  | { aplicar: (texto: string) => Transformar; aplicarCliente?: undefined }
  | { aplicar?: undefined; aplicarCliente: (texto: string) => TransformarCliente };

type BaseProps = Destino & {
  /** Identificador do rascunho (único na janela) */
  id: string;
  rotulo: string;
  valor: string;
  registro?: Registro;
  dica?: string;
  icone?: ReactNode;
  largo?: boolean;
  /** Mostra o selo "obrigatório" quando vazio (avisa, não bloqueia) */
  marcarObrigatorio?: boolean;
  /** Aviso extra embaixo do campo (ex.: valor fora do formato atual) */
  aviso?: string;
  /** Caixa de alerta dentro do cartão do campo (ex.: prazo vencido) */
  alerta?: ReactNode;
  /** Ícone à esquerda do cartão (painel lateral) */
  lateral?: ReactNode;
};

/** Grava no destino certo, com ou sem registro na linha do tempo. */
function useGravacao(props: Destino) {
  const { salvar, salvarComAtividade, salvarCliente, salvarClienteComAtividade } = useJanela();
  return (texto: string, chave: string, atividade?: { tipo: TipoAtividade; texto: string }) => {
    if (props.aplicarCliente) {
      const t = props.aplicarCliente(texto);
      return atividade ? salvarClienteComAtividade(t, atividade.texto, chave) : salvarCliente(t, chave);
    }
    const t = props.aplicar!(texto);
    return atividade ? salvarComAtividade(t, atividade.tipo, atividade.texto, chave) : salvar(t, chave);
  };
}

function Moldura({
  idCampo,
  rotulo,
  icone,
  largo,
  erro,
  dica,
  aviso,
  selo,
  semLapis,
  alerta,
  lateral,
  interno,
  children,
}: {
  idCampo: string;
  rotulo: string;
  icone?: ReactNode;
  largo?: boolean;
  erro?: string;
  dica?: string;
  aviso?: string;
  selo?: string;
  semLapis?: boolean;
  alerta?: ReactNode;
  lateral?: ReactNode;
  interno?: boolean;
  children: ReactNode;
}) {
  if (lateral)
    return (
      <div className={`${j.campo} ${j.campoLateral} ${erro ? j.campoErro : ''}`}>
        <span className={j.campoLateralIcone} aria-hidden>
          {lateral}
        </span>
        <div className={j.campoLateralCorpo}>
          <Moldura idCampo={idCampo} rotulo={rotulo} icone={icone} erro={erro} dica={dica} aviso={aviso} selo={selo} semLapis={semLapis} alerta={alerta} interno>
            {children}
          </Moldura>
        </div>
      </div>
    );
  return (
    <div className={interno ? j.campoInterno : `${j.campo} ${largo ? j.campoLargo : ''} ${erro ? j.campoErro : ''}`}>
      <label htmlFor={idCampo} className={j.campoRotulo}>
        {icone}
        {rotulo}
        {selo && <span className={j.seloObrigatorio}>{selo}</span>}
      </label>
      <div className={j.campoValor}>
        {children}
        {!semLapis && <Pencil size={13} className={j.lapis} aria-hidden />}
      </div>
      {erro ? (
        <small className={j.campoMsgErro} role="alert">
          {erro}
        </small>
      ) : aviso ? (
        <small className={j.campoAviso}>{aviso}</small>
      ) : dica ? (
        <small className={j.campoDica}>{dica}</small>
      ) : null}
      {alerta && (
        <div className={j.alertaCampo} role="note">
          {alerta}
        </div>
      )}
    </div>
  );
}

/** Texto curto ou longo (também número, URL, e-mail e telefone, com validação). */
export function CampoTexto(
  props: BaseProps & {
    area?: boolean;
    /** Não grava vazio (o valor anterior continua salvo) */
    obrigatorio?: boolean;
    placeholder?: string;
    maxLength?: number;
    lista?: string[];
    /** Devolve a mensagem de erro (não grava) ou null */
    validar?: (texto: string) => string | null;
    tipoEntrada?: 'text' | 'email' | 'url' | 'tel';
    modoTeclado?: 'text' | 'decimal' | 'email' | 'url' | 'tel';
  }
) {
  const { id, rotulo, valor, registro, dica, icone, largo, area, obrigatorio, placeholder, maxLength = 300, lista, validar, marcarObrigatorio, aviso, tipoEntrada, modoTeclado, lateral } = props;
  const { rascunho, mudarRascunho, descartarRascunho, estado } = useJanela();
  const gravarNoDestino = useGravacao(props);
  const idCampo = useId();
  const idLista = useId();
  const texto = rascunho(id) ?? valor;
  const aoFocar = useRef<string | null>(null);
  const timer = useRef<number | null>(null);
  /** Último texto digitado (o temporizador não pode depender de uma renderização antiga) */
  const ultimo = useRef<string | undefined>(undefined);
  const [focado, setFocado] = useState(false);
  const vazioInvalido = !!obrigatorio && !texto.trim();
  const erroValidacao = validar ? validar(texto) : null;

  const gravar = (final: boolean) => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    const atual = ultimo.current ?? rascunho(id);
    if (atual === undefined) return;
    const limpo = atual.trim();
    if (obrigatorio && !limpo) return; // fica como rascunho até ter conteúdo
    if (validar && validar(limpo)) return; // fica como rascunho até ficar válido
    const antes = aoFocar.current ?? valor;
    let ok: boolean;
    if (final && registro && limpo !== antes.trim()) {
      ok = gravarNoDestino(limpo, `campo:${id}`, { tipo: registro.tipo, texto: registro.texto(antes.trim(), limpo) });
      aoFocar.current = limpo;
    } else if (limpo !== valor.trim()) {
      ok = gravarNoDestino(limpo, `campo:${id}`);
    } else ok = true;
    if (ok && final) {
      descartarRascunho(id);
      ultimo.current = undefined;
    }
  };

  // Rascunho igual ao valor salvo e campo fora de foco: não é mais rascunho
  useEffect(() => {
    if (!focado && rascunho(id) !== undefined && rascunho(id)!.trim() === valor.trim() && estado.tipo !== 'erro') descartarRascunho(id);
  }, [focado, valor, id, rascunho, descartarRascunho, estado.tipo]);

  // Se o campo sair da tela (troca de aba, fechar) com texto pendente, grava na hora
  const gravarRef = useRef(gravar);
  gravarRef.current = gravar;
  useEffect(
    () => () => {
      if (timer.current || ultimo.current !== undefined) gravarRef.current(true);
    },
    []
  );

  const comum = {
    id: idCampo,
    'data-campo': id,
    className: area ? j.entradaArea : j.entrada,
    value: texto,
    maxLength,
    placeholder: placeholder ?? 'Clique para preencher',
    'aria-invalid': vazioInvalido || !!erroValidacao || undefined,
    onFocus: () => {
      setFocado(true);
      aoFocar.current = valor;
    },
    onBlur: () => {
      setFocado(false);
      gravar(true);
      aoFocar.current = null;
    },
    onChange: (e: { target: { value: string } }) => {
      ultimo.current = e.target.value;
      mudarRascunho(id, e.target.value);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => gravar(false), PAUSA_MS);
    },
  };

  const erro = vazioInvalido
    ? 'Campo obrigatório: o texto anterior continua salvo até você preencher.'
    : erroValidacao
      ? `${erroValidacao}. O que você digitou fica aqui, mas só é salvo quando estiver correto.`
      : undefined;

  return (
    <Moldura
      idCampo={idCampo}
      rotulo={rotulo}
      icone={icone}
      largo={largo || area}
      dica={dica}
      aviso={aviso}
      erro={erro}
      lateral={lateral}
      selo={marcarObrigatorio && !texto.trim() ? 'obrigatório' : undefined}
    >
      {area ? (
        <textarea rows={3} {...comum} />
      ) : (
        <input {...comum} type={tipoEntrada ?? 'text'} inputMode={modoTeclado} list={lista?.length ? idLista : undefined} />
      )}
      {lista?.length ? (
        <datalist id={idLista}>
          {lista.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      ) : null}
    </Moldura>
  );
}

/** Data (AAAA-MM-DD): grava ao escolher. */
export function CampoData(props: BaseProps) {
  const { id, rotulo, valor, registro, dica, icone, marcarObrigatorio, aviso, largo, alerta, lateral } = props;
  const { mudarRascunho, descartarRascunho, rascunho } = useJanela();
  const gravarNoDestino = useGravacao(props);
  const idCampo = useId();
  const texto = rascunho(id) ?? valor;
  return (
    <Moldura idCampo={idCampo} rotulo={rotulo} icone={icone} dica={dica} aviso={aviso} largo={largo} alerta={alerta} lateral={lateral} selo={marcarObrigatorio && !texto ? 'obrigatório' : undefined}>
      <input
        id={idCampo}
        data-campo={id}
        type="date"
        className={j.entrada}
        value={texto}
        onChange={(e) => {
          const novo = e.target.value;
          mudarRascunho(id, novo);
          if (novo && !/^\d{4}-\d{2}-\d{2}$/.test(novo)) return;
          const ok = gravarNoDestino(novo, `campo:${id}`, registro ? { tipo: registro.tipo, texto: registro.texto(valor, novo) } : undefined);
          if (ok) descartarRascunho(id);
        }}
      />
    </Moldura>
  );
}

/** Lista de opções: grava ao escolher. Um valor que saiu das opções continua aparecendo. */
export function CampoLista(props: BaseProps & { opcoes: Array<{ id: string; nome: string }>; textoVazio?: string }) {
  const { id, rotulo, valor, registro, dica, icone, opcoes, textoVazio = 'Não definida', marcarObrigatorio, aviso, largo } = props;
  const { mudarRascunho, descartarRascunho, rascunho } = useJanela();
  const gravarNoDestino = useGravacao(props);
  const idCampo = useId();
  const texto = rascunho(id) ?? valor;
  const nome = (v: string) => opcoes.find((o) => o.id === v)?.nome ?? (v || textoVazio.toLowerCase());
  const foraDaLista = !!valor && !opcoes.some((o) => o.id === valor);
  return (
    <Moldura idCampo={idCampo} rotulo={rotulo} icone={icone} dica={dica} aviso={aviso} largo={largo} selo={marcarObrigatorio && !texto ? 'obrigatório' : undefined}>
      <select
        id={idCampo}
        data-campo={id}
        className={j.entrada}
        value={texto}
        onChange={(e) => {
          const novo = e.target.value;
          mudarRascunho(id, novo);
          const ok = gravarNoDestino(novo, `campo:${id}`, registro ? { tipo: registro.tipo, texto: registro.texto(nome(valor), nome(novo)) } : undefined);
          if (ok) descartarRascunho(id);
        }}
      >
        <option value="">{textoVazio}</option>
        {foraDaLista && <option value={valor}>{valor} (opção que não existe mais)</option>}
        {opcoes.map((o) => (
          <option key={o.id} value={o.id}>
            {o.nome}
          </option>
        ))}
      </select>
    </Moldura>
  );
}

/** Caixa de marcar (sim/não): grava ao clicar. */
export function CampoMarcar({
  id,
  rotulo,
  marcado,
  aplicar,
  registro,
  aviso,
}: {
  id: string;
  rotulo: string;
  marcado: boolean;
  aplicar: (v: boolean) => Transformar;
  registro?: (v: boolean) => string;
  aviso?: string;
}) {
  const { salvar, salvarComAtividade } = useJanela();
  const idCampo = useId();
  return (
    <div className={`${j.campo} ${j.campoMarcar}`}>
      <label htmlFor={idCampo} className={j.marcarLinha}>
        <input
          id={idCampo}
          data-campo={id}
          type="checkbox"
          checked={marcado}
          onChange={(e) => {
            const v = e.target.checked;
            if (registro) salvarComAtividade(aplicar(v), 'dado', registro(v), `campo:${id}`);
            else salvar(aplicar(v), `campo:${id}`);
          }}
        />
        <span>{rotulo}</span>
      </label>
      {aviso && <small className={j.campoAviso}>{aviso}</small>}
    </div>
  );
}

/** Lista em pílulas (etiquetas, equipe…): adicionar com Enter, remover no X. */
export function ListaChips({
  id,
  itens,
  aplicar,
  textoAdicionar,
  textoMais,
  registroAdicionar,
  registroRemover,
  sugestoes,
  rotuloEntrada,
}: {
  id: string;
  itens: string[];
  aplicar: (lista: string[]) => Transformar;
  textoAdicionar: string;
  textoMais: string;
  registroAdicionar: (item: string) => string;
  registroRemover: (item: string) => string;
  sugestoes?: string[];
  rotuloEntrada: string;
}) {
  const { salvarComAtividade, rascunho, mudarRascunho, descartarRascunho } = useJanela();
  const [abrindo, setAbrindo] = useState(false);
  const idLista = useId();
  const texto = rascunho(id) ?? '';

  const adicionar = () => {
    const novo = texto.trim().slice(0, 40);
    if (!novo) return setAbrindo(false);
    if (itens.some((e) => e.toLowerCase() === novo.toLowerCase())) {
      descartarRascunho(id);
      return setAbrindo(false);
    }
    if (salvarComAtividade(aplicar([...itens, novo]), 'dado', registroAdicionar(novo), `lista:${id}`)) {
      descartarRascunho(id);
      setAbrindo(false);
    }
  };

  const livres = (sugestoes ?? []).filter((s) => !itens.some((i) => i.toLowerCase() === s.toLowerCase()));

  return (
    <div className={j.etiquetas}>
      {itens.map((e) => (
        <span key={e} className={j.etiqueta}>
          {e}
          <button
            type="button"
            aria-label={`Remover ${e}`}
            onClick={() => salvarComAtividade(aplicar(itens.filter((x) => x !== e)), 'dado', registroRemover(e), `lista:${id}`)}
          >
            <X size={12} />
          </button>
        </span>
      ))}
      {abrindo ? (
        <>
          <input
            className={j.etiquetaEntrada}
            autoFocus
            value={texto}
            maxLength={40}
            aria-label={rotuloEntrada}
            placeholder={rotuloEntrada}
            list={livres.length ? idLista : undefined}
            onChange={(e) => mudarRascunho(id, e.target.value)}
            onBlur={adicionar}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                adicionar();
              } else if (e.key === 'Escape') {
                e.stopPropagation();
                descartarRascunho(id);
                setAbrindo(false);
              }
            }}
          />
          {livres.length ? (
            <datalist id={idLista}>
              {livres.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          ) : null}
        </>
      ) : (
        <button type="button" className={j.linkAcao} onClick={() => setAbrindo(true)}>
          <Plus size={14} /> {itens.length ? textoMais : textoAdicionar}
        </button>
      )}
    </div>
  );
}

/** Etiquetas do projeto (cabeçalho e Ficha). */
export function Etiquetas() {
  const { projeto } = useJanela();
  return (
    <ListaChips
      id="nova-etiqueta"
      itens={projeto.etiquetas ?? []}
      aplicar={(lista) => (p) => ({ ...p, etiquetas: lista })}
      textoAdicionar="Adicionar etiquetas"
      textoMais="Etiqueta"
      rotuloEntrada="Nova etiqueta"
      registroAdicionar={(e) => `Etiqueta adicionada: ${e}`}
      registroRemover={(e) => `Etiqueta removida: ${e}`}
    />
  );
}
