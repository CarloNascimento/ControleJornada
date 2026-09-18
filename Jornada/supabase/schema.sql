-- Gazin Log Cloud — Supabase schema
-- Execute este arquivo no Supabase: SQL Editor > New query > Run.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  nome text not null,
  login_email text not null unique,
  is_admin boolean not null default false,
  modes jsonb not null default '{"consolidado":false,"analitico":false}'::jsonb,
  screens jsonb not null default '{"consolidado":[],"analitico":[]}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.consolidado (
  month_key text primary key,
  label text not null,
  imported_at timestamptz not null default now(),
  file_name text,
  records jsonb not null default '[]'::jsonb,
  errors jsonb not null default '[]'::jsonb,
  stats jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.analitico (
  lote_id text primary key,
  file_name text,
  imported_at timestamptz not null default now(),
  records jsonb not null default '[]'::jsonb,
  errors jsonb not null default '[]'::jsonb,
  stats jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists consolidado_set_updated_at on public.consolidado;
create trigger consolidado_set_updated_at
before update on public.consolidado
for each row execute function public.set_updated_at();

drop trigger if exists analitico_set_updated_at on public.analitico;
create trigger analitico_set_updated_at
before update on public.analitico
for each row execute function public.set_updated_at();

-- Função usada pelas políticas RLS para respeitar os modos liberados ao usuário.
create or replace function public.user_has_mode(mode_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        p.is_admin = true
        or coalesce((p.modes ->> mode_name)::boolean, false) = true
      )
  );
$$;

revoke all on function public.user_has_mode(text) from public;
grant execute on function public.user_has_mode(text) to authenticated;

alter table public.profiles enable row level security;
alter table public.consolidado enable row level security;
alter table public.analitico enable row level security;

-- O frontend só precisa ler o próprio perfil. Administração de usuários passa
-- pelas Functions da Vercel usando a Service Role.
drop policy if exists "profile_read_own" on public.profiles;
create policy "profile_read_own"
on public.profiles
for select
to authenticated
using (id = auth.uid());

-- Dados compartilhados do modo Consolidado.
drop policy if exists "consolidado_select" on public.consolidado;
create policy "consolidado_select"
on public.consolidado for select to authenticated
using (public.user_has_mode('consolidado'));

drop policy if exists "consolidado_insert" on public.consolidado;
create policy "consolidado_insert"
on public.consolidado for insert to authenticated
with check (public.user_has_mode('consolidado'));

drop policy if exists "consolidado_update" on public.consolidado;
create policy "consolidado_update"
on public.consolidado for update to authenticated
using (public.user_has_mode('consolidado'))
with check (public.user_has_mode('consolidado'));

drop policy if exists "consolidado_delete" on public.consolidado;
create policy "consolidado_delete"
on public.consolidado for delete to authenticated
using (public.user_has_mode('consolidado'));

-- Dados compartilhados do modo Analítico.
drop policy if exists "analitico_select" on public.analitico;
create policy "analitico_select"
on public.analitico for select to authenticated
using (public.user_has_mode('analitico'));

drop policy if exists "analitico_insert" on public.analitico;
create policy "analitico_insert"
on public.analitico for insert to authenticated
with check (public.user_has_mode('analitico'));

drop policy if exists "analitico_update" on public.analitico;
create policy "analitico_update"
on public.analitico for update to authenticated
using (public.user_has_mode('analitico'))
with check (public.user_has_mode('analitico'));

drop policy if exists "analitico_delete" on public.analitico;
create policy "analitico_delete"
on public.analitico for delete to authenticated
using (public.user_has_mode('analitico'));

-- Garantia adicional: usuário anônimo não recebe acesso direto às tabelas.
revoke all on table public.profiles from anon;
revoke all on table public.consolidado from anon;
revoke all on table public.analitico from anon;

grant select on table public.profiles to authenticated;
grant select, insert, update, delete on table public.consolidado to authenticated;
grant select, insert, update, delete on table public.analitico to authenticated;
