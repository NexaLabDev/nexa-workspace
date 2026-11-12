/** Validação isolada dos predicados da policy (sem Postgres). */
const ws = '11111111-1111-1111-1111-111111111111';
const outros = '22222222-2222-2222-2222-222222222222';
const re = /^[0-9a-f-]{36}\/[A-Za-z0-9_-]{1,160}$/;
const pasta = (n) => n.split('/')[0];
const uidA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const uidB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

function canDelete(papel, name, wsAtual, owner, uid) {
  const podeExcluir = ['administrador', 'gestor', 'colaborador'].includes(papel);
  const adminOuGestor = papel === 'administrador' || papel === 'gestor';
  return (
    re.test(name) &&
    pasta(name) === wsAtual &&
    podeExcluir &&
    (adminOuGestor || owner === uid)
  );
}

const casos = [
  ['colaborador', `${ws}/arq-ok`, ws, uidA, uidA, true],
  ['colaborador', `${ws}/arq-ok`, ws, uidB, uidA, false],
  ['colaborador', `${outros}/arq-x`, ws, uidA, uidA, false],
  ['colaborador', `${ws}/nome invalido!`, ws, uidA, uidA, false],
  ['visualizador', `${ws}/arq-viz`, ws, uidA, uidA, false],
  ['administrador', `${ws}/arq-admin`, ws, uidB, uidA, true],
  ['gestor', `${ws}/arq-g`, ws, uidB, uidA, true],
];

for (const [papel, name, wsAtual, owner, uid, esperado] of casos) {
  const got = canDelete(papel, name, wsAtual, owner, uid);
  if (got !== esperado) {
    console.error('FAIL', { papel, name, owner, uid, got, esperado });
    process.exit(1);
  }
}
console.log('OK predicados storage_delete_policy (' + casos.length + ' casos)');
