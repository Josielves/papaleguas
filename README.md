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

### 🛣️ Criação de Rota (Motorista) — 3 passos
**Passo 1 - Regiões:**
- Selecionar região de origem e destino
- Preço calculado automaticamente conforme regra de negócio

**Passo 2 - Endereços:**
- Campo de endereço com botão GPS
- Geocodificação automática ao sair do campo

**Passo 3 - Detalhes:**
- Data e horário de saída
- Número de assentos (2 a 6)
- Modelo e placa do veículo
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
2. Vá em **SQL Editor** e execute `supabase/schema.sql`
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

### Funções SQL
- `reserve_seat(...)` — reserva atômica sem condições de corrida
- `create_route_with_seats(...)` — cria rota + assentos em uma transação

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
