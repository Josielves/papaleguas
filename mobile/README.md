# Papaleguas Mobile

Aplicativo React Native com Expo para passageiros e motoristas. O painel web
administrativo permanece na raiz do repositorio.

## Configuracao

1. Copie `.env.example` para `.env`.
2. Informe a URL e a chave publicavel do Supabase.
3. Informe o Project ID do Expo para registrar push tokens.
4. No Supabase, execute `migration_mobile_push_and_realtime.sql` depois das
   migracoes anteriores.

```powershell
npm install
npx expo start
```

Sem variaveis do Supabase, o aplicativo abre em modo demonstracao para permitir
validacao visual e navegacao local.

## APK Android

```powershell
npm run android:apk
```

O build local gera um APK de teste para celulares ARM64 em:

```text
android/app/build/outputs/apk/release/app-release.apk
```

Defina `ANDROID_ABIS` antes do comando para compilar outra lista de arquiteturas.
O script aplica automaticamente um ajuste de link do NDK necessario apenas no
toolchain local do Windows.

O comando gera `release` por padrao, com o JavaScript incorporado e assinatura
de desenvolvimento para testes. Para uma variante conectada ao Metro, defina
`ANDROID_VARIANT=debug`.

Para distribuicao na Play Store, configure a assinatura de release e gere AAB
com EAS Build ou Gradle. Push remoto tambem exige credenciais FCM/APNs e o
Project ID real do Expo.

## Push remoto

Publique a funcao e configure um Database Webhook para `INSERT` na tabela
`public.notifications`, usando a funcao `send-push`:

```powershell
npx supabase functions deploy send-push --no-verify-jwt
npx supabase secrets set PUSH_WEBHOOK_SECRET="gere-um-segredo-forte"
npx supabase secrets set EXPO_ACCESS_TOKEN="seu-token-opcional"
```

No Database Webhook, envie o mesmo `PUSH_WEBHOOK_SECRET` no header
`x-papaleguas-secret`. O endpoint recusa requisicoes quando o segredo nao esta
configurado ou nao coincide. Nao exponha a service role no aplicativo.
