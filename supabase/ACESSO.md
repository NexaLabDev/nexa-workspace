# Operação da entrega 1A

A autorização inicial fica em `nexa_privado.autorizacao_inicial`. Use uma sessão administrativa do projeto. Mantenha o schema privado fora dos schemas expostos pela Data API. O frontend continua usando o acesso de teste vigente. Nenhum cadastro do Auth recebe perfil automaticamente.

## Ativação inicial

1. Registre no banco o endereço expressamente autorizado pelo proprietário. Use parâmetros privados. Não publique o endereço, o UUID real nem a instrução preenchida no Git. Uma única linha é permitida.
2. Confirme a titularidade pelo fluxo de confirmação de e-mail do Auth. Confira que o UUID, o endereço atual e a confirmação pertencem à conta esperada. Não use confirmação manual de cadastro como prova de titularidade.
3. Com o UUID verificado, execute a ativação como operador. O banco valida a autorização, bloqueia a linha contra concorrência e cria o workspace e seu primeiro administrador na mesma transação. A autorização consumida não pode ser reutilizada pela rotina. Uma nova tentativa após sucesso não duplica os dados.

Modelos para consultas parametrizadas do operador:

```sql
insert into nexa_privado.autorizacao_inicial(email) values (lower(btrim($1)));
select nexa_privado.ativar_inicial($1::uuid);
```

## Associação de outras contas

Após aprovação e verificação da identidade, use a consulta abaixo com o workspace, o UUID do Auth e o e-mail esperado. O ingresso é como visualizador. O vínculo é único por conta. Um administrador do workspace pode ajustar o papel. O gestor gerencia somente colaboradores e visualizadores. Cada usuário ativo pode editar seu nome e cargo.

```sql
select nexa_privado.associar_visualizador($1::uuid, $2::uuid, $3);
```

## Recuperação administrativa

Priorize a recuperação da própria conta pelos canais de identidade do Supabase. Quando houver transferência de responsabilidade, um operador autenticado no painel verifica a autorização do proprietário e a titularidade da conta de destino. Registre o motivo no chamado interno. Confira o workspace e os UUIDs antes de agir.

Se necessário, associe antes a nova conta confirmada usando a consulta acima. Como operador, em uma transação, promova o destino por UUID e workspace, confira a linha retornada e confirme o acesso do novo administrador antes de desativar o anterior. O bloqueio do último administrador também vale para suspensão e exclusão no Auth. O desbloqueio no Auth exige reativação explícita do perfil. A recuperação não depende de endpoint público, senha mestra ou metadados do usuário.

```sql
update public.perfis set papel = 'administrador', ativo = true
where id = $1::uuid and workspace_id = $2::uuid
returning id, workspace_id, papel, ativo;
```

## Auditoria e testes

Na mesma transação da alteração, gatilhos registram horário, origem da operação, entidade, identificador e campos alterados. Para alterações de acesso, também registram papel e status anteriores e posteriores. O UUID do ator vem de Auth nas sessões de usuários. Operações administrativas diretas registram o papel de banco e deixam o UUID vazio quando não há JWT. A identidade pessoal do operador do painel depende dos registros administrativos da plataforma. Os papéis da API não recebem escrita no histórico. O proprietário do banco continua sendo uma parte confiável.

Execute os testes em uma instância descartável com schema Auth compatível e a migração aplicada. A suíte SQL usa duas organizações e termina em rollback. O teste concorrente usa duas conexões locais, exige o pacote Node `pg` no ambiente de testes e deixa fixtures nesse banco descartável.

```sh
psql -X -v ON_ERROR_STOP=1 -f supabase/tests/workspace_acesso.sql
node supabase/tests/concorrencia.cjs
```

## Versões da migração

O SQL principal mantém a versão original `20261111141500`. O conector do Supabase executou esse mesmo conteúdo e registrou o recibo `20261111165716`. O segundo arquivo valida a estrutura em novas instalações. No projeto hospedado, a versão original é reconhecida no histórico somente após comparar o conteúdo do recibo com o arquivo principal. Assim, o próximo push não tenta criar as tabelas outra vez.
