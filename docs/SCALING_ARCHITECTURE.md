# Arquitetura de crescimento do Papaleguas

## O que esta base resolve

- Reservas, cancelamentos e fila continuam atomicos no PostgreSQL.
- O ultimo ponto do motorista fica em `route_locations`, sem reescrever a rota inteira.
- O servidor limita atualizacoes de localizacao a uma a cada cinco segundos por rota.
- Geocodificacao passa pela Edge Function `geocode`, com cache de 30 dias.
- O Nominatim publico fica protegido por um limite global de uma chamada por segundo.
- URL e atribuicao dos mapas podem apontar para um provedor contratado.
- Dados pessoais de perfis deixam de ser consultaveis por qualquer conta autenticada.

Isso e uma fundacao de crescimento, nao uma garantia de 10 milhoes de conexoes.

## Limites de responsabilidade

| Dominio | Fonte principal | Proxima evolucao |
| --- | --- | --- |
| Usuarios e sessao | Supabase Auth | MFA administrativo, deteccao de abuso e projetos por ambiente |
| Rotas e reservas | PostgreSQL/RPC | replicas de leitura, particionamento e arquivamento |
| Localizacao atual | `route_locations` | servico de eventos regional quando a escrita exigir |
| Chat | PostgreSQL + Realtime | retencao, paginacao por cursor e particionamento temporal |
| Notificacoes | PostgreSQL + Realtime | outbox, fila e entrega push assicrona |
| Geocodificacao | Edge Function + cache | provedor com SLA ou instancia propria |
| Mapas | provedor configuravel | contrato de tiles com CDN e cota adequada |

## Portoes de capacidade

Nenhuma etapa deve ser liberada apenas por estimativa. Meça p95, erros, conexoes,
mensagens por segundo, IOPS, CPU e custo em cada nivel.

1. 1.000 simultaneos: validar fluxos completos e concorrencia de assentos.
2. 10.000 simultaneos: plano Supabase adequado, dashboards, alertas e teste de falha.
3. 100.000 simultaneos: contrato Enterprise, teste de Realtime e isolamento de localizacao.
4. 1.000.000 simultaneos: multiplas regioes e dominios distribuidos.
5. 10.000.000 simultaneos: sharding planejado, operacao 24x7 e ensaio de desastre.

## Aplicacao da infraestrutura

Execute as migracoes na ordem documentada no README e publique a funcao:

```bash
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase functions deploy geocode
npx supabase secrets set GEOCODING_USER_AGENT="Papaleguas/2.0 (contato@seu-dominio.com)"
```

Para alto volume, use uma API compativel com Nominatim contratada:

```bash
npx supabase secrets set GEOCODING_PROVIDER="managed"
npx supabase secrets set GEOCODING_BASE_URL="https://seu-provedor.example"
```

No frontend, configure um provedor de tiles autorizado para o volume esperado:

```env
VITE_MAP_TILE_URL=https://tiles.seu-provedor.example/{z}/{x}/{y}.png
VITE_MAP_ATTRIBUTION=Dados do mapa e provedor
VITE_LOCATION_INTERVAL_MS=10000
```

## Teste inicial de busca

Instale o k6 e rode apenas contra staging:

```powershell
$env:SUPABASE_URL="https://projeto-staging.supabase.co"
$env:SUPABASE_ANON_KEY="chave-anon-staging"
$env:TEST_ACCESS_TOKEN="token-de-um-usuario-de-teste"
npm run load:routes
```

O teste inicial usa 25 usuarios virtuais e exige menos de 1% de erros e p95
abaixo de 800 ms. Aumente em etapas, nunca diretamente em producao.
