# Papaleguas

Aplicativo React + Tailwind para transporte compartilhado por rotas fixas de bairros e cidades.

## Rodar localmente

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Autenticacao

O app usa Supabase Auth para cadastro/login com email e senha.

No cadastro, o usuario escolhe o tipo de conta:

- Cliente
- Motorista

## Publicar na Vercel

1. Suba este projeto para o GitHub.
2. Na Vercel, importe o repositorio.
3. Framework: `Vite`.
4. Build command: `npm run build`.
5. Output directory: `dist`.
6. Adicione as variaveis de ambiente do arquivo `.env.example`.

## Supabase

1. Crie um projeto no Supabase.
2. Abra o SQL Editor.
3. Execute o arquivo `supabase/schema.sql`.
4. Copie `Project URL` e `anon public key` para as variaveis:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Depois de executar o schema, todo novo usuario criado pelo Supabase Auth gera automaticamente um registro na tabela `profiles`.

## Funcionalidades de mobilidade

- Geolocalizacao pelo navegador para passageiros encontrarem rotas proximas.
- Rotas com origem/destino por regioes: Centro, Norte, Sul, Leste e Oeste.
- Valor calculado por tabela regional:
  - Mesma regiao: R$ 7,00
  - Centro para demais regioes: R$ 9,00
  - Regioes adjacentes: R$ 12,00
  - Extremos Norte/Sul ou Leste/Oeste: R$ 16,00
- Motorista pode publicar rota como "em rota agora".
- Rotas em andamento continuam visiveis enquanto houver assentos disponiveis.
- Reserva libera chat entre passageiro e motorista.
- Perfil aceita foto, numero de contato e chave Pix.
