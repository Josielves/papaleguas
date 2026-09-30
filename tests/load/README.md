# Testes de carga

Estes cenarios medem a infraestrutura implantada. Eles nao provam capacidade
quando executados contra o Vite local ou com dados insuficientes.

## Preparacao

1. Aplique `supabase/migration_hyperscale_foundation.sql` em um projeto de teste.
2. Gere pelo menos 100 mil rotas futuras distribuidas entre as regioes.
3. Crie um usuario exclusivo de carga e informe um JWT valido em
   `TEST_ACCESS_TOKEN`.
4. Instale o k6 e execute de uma maquina fora da regiao do banco.

Nunca use usuarios reais, chaves de `service_role` ou o ambiente de producao.

## Execucao progressiva

No PowerShell:

```powershell
$env:SUPABASE_URL="https://SEU_PROJETO.supabase.co"
$env:SUPABASE_ANON_KEY="SUA_CHAVE_ANON"
$env:TEST_ACCESS_TOKEN="JWT_DO_USUARIO_DE_TESTE"

$env:TARGET_RPS="25";    $env:DURATION="2m";  npm run load:routes
$env:TARGET_RPS="100";   $env:DURATION="5m";  npm run load:routes
$env:TARGET_RPS="1000";  $env:DURATION="10m"; npm run load:routes
$env:TARGET_RPS="3000";  $env:DURATION="15m"; npm run load:routes
$env:TARGET_RPS="10000"; $env:DURATION="60m"; npm run load:routes
```

O teste usa taxa de chegada constante, pagina de 20 rotas e falha se houver
iteracoes descartadas, mais de 1% de erros ou p95 acima de `P95_MS` (500 ms por
padrao). Ajuste `PRE_ALLOCATED_VUS` e `MAX_VUS` somente quando a maquina geradora
for o gargalo.

## Portoes de liberacao

- Smoke e 100 RPS passam antes de qualquer teste maior.
- Cada etapa passa tres vezes sem aumentar conexoes, CPU ou I/O continuamente.
- O patamar de 10 mil RPS passa por 60 minutos e depois por um soak de 24 horas.
- Reservas, cancelamentos, promocao da fila e idempotencia sao testados em um
  cenario separado com dados descartaveis antes de liberar producao.
- A geracao de carga deve ser distribuida em varias maquinas a partir de 1 mil
  RPS para evitar medir apenas o cliente do teste.
