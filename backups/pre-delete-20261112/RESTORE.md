# Restore — pré DELETE Storage (2026-11-12)

Projeto Cloud: `tiqyujibhjwnrpqpqmep`  
Bucket: `nexa-arquivos` (privado, **0 objetos** na captura)

## O que este pacote cobre

| Camada | Conteúdo | Recuperação |
|---|---|---|
| RLS Storage | baseline CREATE/READ + rollback DELETE | SQL deste diretório |
| Schema app | migrações `20261111141500`…`20261111174910` | repo `supabase/migrations/` |
| Dados negócio | contagens em `inventario.json` (quase vazio) | Dashboard backup / PITR + re-sync app |
| Auth users | gerenciado pelo Supabase Auth | Dashboard → Database backups |
| Arquivos Storage | **0 objetos** | N/A agora; futuro: download do bucket antes de mudanças |

## Backup oficial recuperável (obrigatório antes do apply)

1. Supabase Dashboard → **Project Settings → Database → Backups**
2. Confirmar backup diário disponível **ou** disparar/baixar backup lógico se o plano permitir
3. Anotar horário do snapshot (UTC) neste arquivo
4. Storage: com 0 objetos, metadata do bucket basta; se houver arquivos no futuro, baixar o prefixo do workspace antes de mudanças destrutivas

### Validação do procedimento (feita)

- Inventário Cloud lido (só SELECT) → `inventario.json`
- Helpers `workspace_id_atual` / `pode` / `papel_atual` presentes
- Matriz `arquivos.excluir` para administrador/gestor/colaborador
- **Rollback + reapply** da policy DELETE testados no Docker isolado (`supabase_db_nexa-teste-local`):
  - antes: `apagar,criar,ler`
  - após `drop policy nexa_arquivo_apagar`: `criar,ler`
  - após reapply: `apagar,criar,ler`
- Cloud **não** foi alterada

## Como restaurar só a policy DELETE

```sql
-- no SQL Editor do projeto Cloud
\i 03_rollback_delete.sql
```

Ou colar o conteúdo de `03_rollback_delete.sql`.

## Como restaurar CREATE/READ (se corrompidas)

Colar `01_baseline_storage_policies.sql` no SQL Editor.

## Como reaplicar DELETE após rollback

Colar `02_aplicar_delete.sql` (com autorização).

## Restore completo de banco (desastre)

1. Dashboard → Database → Restores / PITR até o timestamp anotado
2. Reaplicar migrações do repo se o restore for anterior a alguma delas
3. Conferir policies com a query de `03_rollback_delete.sql`
4. Smoke: login admin → upload anexo → (se DELETE aplicada) apagar anexo

## Storage (quando houver objetos)

1. Listar `storage.objects` onde `bucket_id = 'nexa-arquivos'`
2. Baixar via Dashboard Storage ou API autenticada
3. Após restore de DB, reupload se os blobs não estiverem no backup do Storage
