/** Validação isolada dos predicados da policy (sem Postgres/Docker). */
const ws = '11111111-1111-1111-1111-111111111111';
const outros = '22222222-2222-2222-2222-222222222222';
const re = /^[0-9a-f-]{36}\/[A-Za-z0-9_-]{1,160}$/;
const pasta = (n) => n.split('/')[0];
const podeExcluir = { administrador: true, gestor: true, colaborador: true, visualizador: false };

function canDelete(papel, name, wsAtual) {
  return re.test(name) && pasta(name) === wsAtual && !!podeExcluir[papel];
}

const casos = [
  ['colaborador', `${ws}/arq-ok`, ws, true],
  ['colaborador', `${outros}/arq-x`, ws, false],
  ['colaborador', `${ws}/nome invalido!`, ws, false],
  ['visualizador', `${ws}/arq-viz`, ws, false],
  ['administrador', `${ws}/arq-admin`, ws, true],
];

for (const [papel, name, wsAtual, esperado] of casos) {
  const got = canDelete(papel, name, wsAtual);
  if (got !== esperado) {
    console.error('FAIL', { papel, name, got, esperado });
    process.exit(1);
  }
}
console.log('OK predicados storage_delete_policy (' + casos.length + ' casos)');
