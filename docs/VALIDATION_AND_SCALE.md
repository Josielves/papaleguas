# Validacao e escala do Papaleguas

Este projeto agora compila com a camada de componentes que conversa com o schema atual do Supabase: `profiles.account_type`, `routes.departure_time`, `status = scheduled/open/full/cancelled`, RPCs `create_route_with_seats`, `reserve_seat`, `start_route`, `cancel_booking` e mensagens por `booking_id`.

## Validacao atual

Comandos executados:

```bash
npm ci --cache .npm-cache
npm run build
npm audit --audit-level=moderate --cache .npm-cache
```

Resultado:

- Build de producao aprovado.
- Os paineis principais usam carregamento sob demanda para separar mapas e fluxos administrativos do bundle inicial.
- `npm audit --omit=dev` aprovado sem vulnerabilidades nas dependencias de producao.
- A auditoria completa ainda aponta avisos nas ferramentas de build do Vite e `@capacitor/assets`; as correcoes restantes exigem upgrades maiores ou dependem dos mantenedores.

### Fluxos operacionais adicionados

- Motorista cria uma rota agendada e escolhe quando inicia-la no painel.
- Passageiro visualiza rotas abertas, escolhe um assento livre ou entra na fila de uma rota lotada.
- Cancelamento de reserva promove atomicamente a primeira pessoa da fila para o mesmo assento.
- Motorista e passageiro promovido recebem notificacao persistida no banco e em tempo real.
- Perfil permite foto e contato; motoristas tambem cadastram modelo, cor e placa do veiculo.

Para estes fluxos, aplique `supabase/migration_operations_and_waitlist.sql` depois das migracoes anteriores.

## Fluxos que precisam passar antes de deploy

- Cadastro de passageiro cria `profiles.name`, `profiles.phone`, `profiles.account_type = passenger`.
- Cadastro de motorista cria `profiles.account_type = driver`.
- Login e logout preservam/limpam sessao.
- Motorista cria rota futura com 2 a 6 assentos.
- Motorista inicia rota; rota muda de `scheduled` para `open`.
- Passageiro busca rotas abertas por origem/destino.
- Passageiro reserva assento; `seats.status` muda para `reserved`, `bookings.status` fica `confirmed`, `routes.available_seats` decrementa.
- Dois passageiros tentando o mesmo assento ao mesmo tempo: apenas um deve vencer.
- Passageiro cancela reserva; assento volta para `available`.
- Passageiro cancela com fila ativa; o assento permanece `reserved` e passa para a primeira pessoa da fila.
- Rota lotada permite entrar e sair da lista de espera sem duplicidade.
- Cancelamento da rota encerra reservas e fila e cria notificacoes para os passageiros afetados.
- Perfil do motorista salva foto, contato, modelo, cor e placa do veiculo.
- Chat entre passageiro e motorista salva mensagens com `booking_id`.
- Transmissao de localizacao do motorista atualiza `routes.driver_lat`, `routes.driver_lng` e aparece no mapa.
- RLS: passageiro nao le reservas de outros passageiros; motorista so ve reservas das proprias rotas.

## Estrutura para 10 milhoes de usuarios

Supabase pode sustentar um MVP serio, mas 10 milhoes de usuarios exigem arquitetura por carga, nao apenas mais indices.

- Frontend: hospedar estatico em CDN, ativar code splitting para `react-leaflet`, carregar mapa apenas quando o usuario abrir acompanhamento, monitorar Web Vitals.
- Banco: aplicar `supabase/migration_scale_and_security.sql`, revisar planos com `EXPLAIN ANALYZE`, limitar consultas por pagina, e criar politicas de retencao/arquivamento para rotas antigas, mensagens e localizacao.
- Realtime: nao assinar tabelas amplas. Usar canais filtrados por `route_id`/`booking_id`, limitar transmissao de GPS por intervalo e desligar broadcast ao cancelar/finalizar rota.
- API critica: manter reserva/cancelamento em RPC transacional. Toda RPC `security definer` deve validar `auth.uid()` internamente.
- Observabilidade: registrar erro por fluxo, latencia de RPC, taxa de reserva concorrente, conexoes realtime, falhas de geocoding, tamanho de bundle e funil de cadastro.
- Seguranca: remover credenciais reais de arquivos exemplo, ativar MFA para administradores Supabase, separar projetos dev/staging/prod, e revisar RLS antes de dados reais.
- Escala de produto: para 10M, separar dominios quando necessario: rotas/reservas no Postgres, eventos de localizacao em estrutura propria de alta escrita, notificacoes em fila, analytics fora do OLTP.

## Proximas validacoes automatizadas

Adicionar depois:

- Vitest para `getPrice`, `distanceKm`, `whatsAppLink`, ordenacao de paradas e validacoes de formulario.
- Playwright para cadastro/login/criar rota/iniciar rota/reservar/cancelar/chat usando um projeto Supabase de staging.
- Teste SQL com dados semente para RLS e RPCs concorrentes.
- k6 ou Artillery para busca de rotas, reserva concorrente e WebSocket/realtime.
