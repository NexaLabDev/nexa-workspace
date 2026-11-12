# Remove ACESSO_TESTE_* da Vercel após confirmação de que não há consumidores.
# Uso (na raiz do repo, com login Vercel já feito):
#   powershell -File scripts/remover-acesso-teste-vercel.ps1
#
# Verificação prévia (2026-11-12):
# - Código/E2E: usam E2E_EMAIL / E2E_SENHA ou defaults Docker (admin@teste.local)
# - Nenhuma referência a ACESSO_TESTE_USUARIO / ACESSO_TESTE_SENHA no app

$ErrorActionPreference = 'Stop'
$scope = 'nexa-lab'

Write-Host "Removendo ACESSO_TESTE_USUARIO e ACESSO_TESTE_SENHA (Production + Preview)..."

foreach ($nome in @('ACESSO_TESTE_USUARIO', 'ACESSO_TESTE_SENHA')) {
  Write-Host "→ npx vercel env remove $nome --scope $scope --confirm-name $nome"
  npx vercel env remove $nome --scope $scope --confirm-name $nome
}

Write-Host "Conferido:"
npx vercel env ls --scope $scope
Write-Host "Pronto."
