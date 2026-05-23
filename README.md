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
