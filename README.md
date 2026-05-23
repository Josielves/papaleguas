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

## Login demo

- Cliente: `cliente@papaleguas.com` / `cliente123`
- Motorista: `motorista@papaleguas.com` / `motorista123`

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

> A versao atual usa autenticacao mockada no frontend. O schema acima prepara a base para conectar Supabase Auth e as tabelas reais na proxima etapa.
