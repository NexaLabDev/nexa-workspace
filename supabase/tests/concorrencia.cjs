// Banco descartável no loopback, já migrado. Requer o pacote de teste "pg".
// PGPORT, PGDATABASE e PGUSER selecionam o banco local. Fixtures persistem nele.
const { randomUUID } = require('node:crypto');
const assert = require('node:assert/strict');
const { Client } = require('pg');

async function testar() {
  const cfg = { host: '127.0.0.1' };
  const a = new Client(cfg);
  const b = new Client(cfg);
  await a.connect();
  try {
    await b.connect();
    const ws = randomUUID();
    const ids = [randomUUID(), randomUUID()];
    await a.query('begin');
    await a.query("insert into public.workspaces(id,nome) values ($1,'Concorrência de teste')", [ws]);
    for (const id of ids) {
      await a.query("insert into auth.users(id,email,email_confirmed_at,is_anonymous) values ($1,$2,now(),false)", [id, id + '@example.invalid']);
      await a.query("insert into public.perfis(id,workspace_id,papel) values ($1,$2,'administrador')", [id, ws]);
    }
    await a.query('commit');
    await a.query('begin');
    await b.query('begin');
    await a.query("set local statement_timeout = '10s'");
    await b.query("set local statement_timeout = '10s'");
    await a.query('update public.perfis set ativo=false where id=$1', [ids[0]]);
    const segunda = b.query('update public.perfis set ativo=false where id=$1', [ids[1]]);
    // Aguarda o bloqueio real entre sessões antes de liberar a primeira.
    const limite = Date.now() + 5000;
    let bloqueada = false;
    while (!bloqueada && Date.now() < limite) {
      const { rows } = await a.query('select pg_backend_pid() = any(pg_blocking_pids($1)) as bloqueada', [b.processID]);
      bloqueada = rows[0].bloqueada;
      if (!bloqueada) await new Promise(resolve => setTimeout(resolve, 15));
    }
    assert.ok(bloqueada, 'a segunda escrita deve aguardar a primeira');
    await a.query('commit');
    await segunda;
    await assert.rejects(b.query('commit'), { code: '23514' });
    const { rows } = await a.query(`select w.admins_ativos, count(p.id)::int as contagem
      from public.workspaces w left join public.perfis p on p.workspace_id=w.id and p.ativo and p.papel='administrador'
      where w.id=$1 group by w.id`, [ws]);
    assert.deepEqual(rows, [{ admins_ativos: 1, contagem: 1 }]);
    console.log('Concorrência confirmada: um administrador ativo após duas desativações simultâneas.');
  } finally {
    await a.end();
    await b.end();
  }
}
testar().catch(err => { console.error(err); process.exitCode = 1; });
