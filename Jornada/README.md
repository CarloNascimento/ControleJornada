# Gestão de Jornada — Gazin Log Cloud

Versão preparada para **Vercel + Supabase** a partir do HTML original.

## O que mudou

- O layout, filtros, gráficos, importação de Excel e cálculos do HTML original foram preservados.
- O armazenamento em `IndexedDB` foi removido.
- Consolidado e Analítico agora ficam em **PostgreSQL (Supabase)**.
- Login e senhas agora usam **Supabase Auth**.
- Cadastro e exclusão de usuários passam por **Vercel Serverless Functions**, sem expor a `service_role` no navegador.
- As permissões de acesso aos modos Consolidado/Analítico são validadas também pelo banco via **RLS**.
- A sessão fica apenas no `sessionStorage`; os dados operacionais não são guardados no navegador.

## Publicar — 3 passos

### 1. Criar o banco no Supabase

Crie um projeto em https://supabase.com.

No projeto, abra **SQL Editor**, copie todo o conteúdo de:

`supabase/schema.sql`

e execute.

### 2. Subir este projeto para a Vercel

Pode subir esta pasta no GitHub e importar o repositório na Vercel.

Na Vercel, adicione em **Settings > Environment Variables**:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Os valores ficam em **Supabase > Project Settings > API**.

> `SUPABASE_SERVICE_ROLE_KEY` é secreta. Nunca coloque essa chave no `index.html` ou em um repositório público.

Depois faça um novo deploy.

### 3. Primeiro acesso

Abra o endereço publicado na Vercel.

Como o banco começa sem usuários, o sistema mostrará **Criar administrador**. Crie a primeira conta. Depois disso, a mesma tela passa a mostrar apenas o login.

O administrador consegue usar **Gerenciar usuários** para criar os demais acessos.

## Estrutura

```text
index.html                    interface original adaptada
api/config.js                 entrega apenas configuração pública ao navegador
api/auth/status.js            verifica se já existe administrador
api/auth/bootstrap.js         cria o primeiro administrador
api/auth/login.js             login por usuário + senha
api/users.js                  gerenciamento de usuários (somente admin)
lib/supabaseServer.js         funções compartilhadas do backend
supabase/schema.sql           banco + RLS
vercel.json                   headers de segurança
.env.example                  nomes das variáveis necessárias
```

## Importante

Os relatórios de jornada podem conter dados corporativos e pessoais. Antes de colocar o sistema em produção, valide com a TI/LGPD da empresa se o uso de Supabase/Vercel está homologado para esse tipo de informação.
