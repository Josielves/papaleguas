# 🚗 Papaleguas v2.0

Aplicativo React + Tailwind para transporte compartilhado por rotas fixas entre regiões da cidade.

---

## ✨ Novas funcionalidades

### 🗺️ API de Localização (Geolocalização)
- Botão "Usar minha localização" ao criar rota (origem e destino)
- Ponto de embarque do passageiro capturado por GPS
- Geocodificação reversa via Nominatim (OpenStreetMap) — sem custo
- Coordenadas salvas no banco para integração futura com mapas

### 🔐 Autenticação aprimorada
- Cadastro com escolha de tipo de conta (Cliente / Motorista) com cards visuais
- Login com feedback de erro claro
- Perfil criado automaticamente via trigger no Supabase
- Sessão persistida entre recarregamentos

### 💬 Chat por Reserva
- Chat em tempo real entre passageiro e motorista
- Mensagens otimistas (aparecem imediatamente)
- Realtime via Supabase subscriptions (WebSocket)
- Badge de mensagens não lidas
- Suporte a Enter para enviar, Shift+Enter para nova linha

### 💺 Reserva de Assento melhorada
- Visualização do interior do carro (assentos em pares)
- Atualização em tempo real quando outro usuário reserva
- Prevenção de dupla reserva (transação atômica no banco)
- Ponto de embarque opcional com GPS
- Confirmação com resumo antes de finalizar
- Cancelamento de reserva com liberação automática do assento
- Lista de espera para rotas lotadas
- Promoção automática da primeira pessoa da fila após um cancelamento
- Notificação para passageiro promovido e motorista

### Painel operacional do motorista
- Fila de rotas agendadas para o motorista escolher e iniciar
- Indicadores de ocupação, passageiros e receita estimada
- Mapa das rotas planejadas e em operação
- Manifesto de passageiros com contato e ponto de embarque
- Acompanhamento da lista de espera de cada rota

### Perfil do usuário
- Foto, nome, telefone, endereço e e-mail da conta
- Consulta da placa pelo backend para preencher marca, modelo, ano e cor
- Cadastro de carro ou van com capacidade confirmada pelo motorista
- Dados do veículo preenchidos automaticamente ao criar uma rota

### 🛣️ Criação de Rota (Motorista) — 3 passos
**Passo 1 - Regiões:**
- Selecionar região de origem e destino
- Preço calculado automaticamente conforme regra de negócio

**Passo 2 - Endereços:**
- Campo de endereço com botão GPS
- Geocodificação automática ao sair do campo

**Passo 3 - Detalhes:**
- Data e horário de saída
- Quantidade de assentos limitada à capacidade do carro ou da van (até 20)
- Modelo e placa do veículo validados a partir do perfil
- Observações
- Resumo com preço calculado

### 💰 Tabela de preços automática
| Rota | Preço |
|------|-------|
| Centro → qualquer região | R$ 10,00 |
| Qualquer região → Centro | R$ 10,00 |
| Região → Região (entre extremos) | R$ 15,00 |

Exemplos: Centro→Norte R$10 | Sul→Norte R$15 | Leste→Oeste R$15

---

## 🚀 Instalação

### 1. Clonar e instalar
```bash
git clone https://github.com/Josielves/papaleguas.git
cd papaleguas
npm install
```

### 2. Configurar Supabase
1. Crie um projeto em [supabase.com](https://supabase.com)
2. Vá em **SQL Editor** e execute, nesta ordem:

```text
supabase/schema.sql
supabase/migration_scale_and_security.sql
supabase/migration_operations_and_waitlist.sql
supabase/migration_scalable_backend.sql
supabase/migration_mobile_push_and_realtime.sql
supabase/migration_vehicle_lookup_and_vans.sql
```

Se o schema principal já estiver instalado, execute somente as migrações que ainda não foram aplicadas.

As migracoes finais protegem o rastreamento, criam os caches e adicionam o
cadastro de carro ou van. Depois delas, publique as Edge Functions:

```bash
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase functions deploy geocode
npx supabase functions deploy vehicle-lookup
npx supabase functions deploy send-push --no-verify-jwt
npx supabase secrets set GEOCODING_USER_AGENT="Papaleguas/2.0 (contato@seu-dominio.com)"
npx supabase secrets set VEHICLE_LOOKUP_PROVIDER="fipeplaca" VEHICLE_LOOKUP_API_TOKEN="SUA_CHAVE"
npx supabase secrets set VEHICLE_LOOKUP_DAILY_LIMIT="20"
npx supabase secrets set PUSH_WEBHOOK_SECRET="gere-um-segredo-forte"
```

A Edge Function usa `https://api.fipeplaca.com.br/gateway/v1` por padrao e
mantem a chave somente no Supabase. O provedor e pago e exige saldo. Para usar
o provedor Placa Fipe, configure `VEHICLE_LOOKUP_PROVIDER="placafipe"` e a chave
correspondente. Resultados bem-sucedidos ficam em cache por 30 dias para reduzir
custo e chamadas repetidas.

Configure o Database Webhook de `public.notifications` com o mesmo segredo no
header `x-papaleguas-secret`.

O plano de capacidade, configuracao de mapas e teste de carga estao em `docs/SCALING_ARCHITECTURE.md`.

3. Copie as variáveis de ambiente:

```bash
cp .env.example .env
# Edite .env com sua URL e chave anon do Supabase
```

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key
```

### 3. Rodar
```bash
npm run dev
```

---

## 🗄️ Estrutura do banco

| Tabela | Descrição |
|--------|-----------|
| `profiles` | Perfis de usuários (cliente/motorista) |
| `regions` | Regiões da cidade com coordenadas |
| `price_rules` | Tabela de preços por par de regiões |
| `routes` | Rotas criadas pelos motoristas |
| `seats` | Assentos de cada rota |
| `bookings` | Reservas dos passageiros |
| `messages` | Mensagens do chat por reserva |
| `route_waitlist` | Fila de espera das rotas lotadas |
| `notifications` | Alertas de promoção, cancelamento e reposição |

### Funções SQL
- `reserve_seat(...)` — reserva atômica sem condições de corrida
- `create_route_with_seats(...)` — cria rota + assentos em uma transação
- `join_route_waitlist(...)` — adiciona passageiro à fila de uma rota lotada
- `cancel_booking(...)` — cancela e promove automaticamente o primeiro da fila
- `cancel_route(...)` — encerra a rota e notifica passageiros afetados

---

## 📁 Estrutura do projeto

```
src/
├── lib/
│   └── supabase.js          # Cliente, helpers, funções API
├── components/
│   ├── Auth.jsx             # Login e cadastro
│   ├── Modal.jsx            # Modal reutilizável
│   ├── RouteCard.jsx        # Card de rota com botão de reserva
│   ├── SeatPicker.jsx       # Seletor de assento visual + realtime
│   ├── Chat.jsx             # Chat em tempo real
│   ├── CreateRoute.jsx      # Formulário 3 passos para motorista
│   ├── DriverDashboard.jsx  # Dashboard do motorista
│   └── MyBookings.jsx       # Lista de reservas do passageiro
└── App.jsx                  # Roteamento e navegação
```

---

## 🌐 Deploy na Vercel

1. Push para GitHub
2. Importe na Vercel
3. Framework: **Vite**
4. Build command: `npm run build`
5. Output: `dist`
6. Adicione as variáveis de ambiente no painel da Vercel

---

## APK Android

O aplicativo movel principal agora esta em `mobile/` e usa React Native, mapa
nativo e notificacoes do sistema. O projeto Capacitor em `android/` foi mantido
temporariamente para compatibilidade com builds anteriores.

Para gerar o APK React Native:

```bash
cd mobile
npm install
npm run android:apk
```

O APK React Native instalavel e criado em:

```text
mobile/android/app/build/outputs/apk/release/app-release.apk
```

Consulte `mobile/README.md` para Supabase, push e build de producao.

### Aplicativo Capacitor legado

O projeto Android usa Capacitor e fica em `android/`. O identificador do aplicativo é `com.papaleguas.app`.

Para sincronizar o frontend e gerar um APK de teste:

```bash
npm run android:assets
npm run android:apk
```

O build requer um JDK entre as versoes 17 e 24; o JDK 21 e recomendado. O script procura automaticamente uma instalacao compativel em `JAVA_HOME`, na pasta `.jdks` do usuario e no Android Studio.

O APK instalável é criado em:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Para abrir o projeto no Android Studio:

```bash
npm run android:open
```

Antes de publicar na Play Store, configure uma chave de assinatura privada e gere um Android App Bundle (`.aab`) de release. Arquivos `.jks` e `.keystore` são ignorados pelo Git.
