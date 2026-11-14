-- Electravelin — almacén de documentos del backend (MVP v2)
--
-- Tabla usada por el backend Express (server/src/services/supabaseStore.js)
-- para persistir sus colecciones (users, vehicles, stations, trips, favorites,
-- audit, meta) como documentos JSON. Es complementaria a las tablas normalizadas
-- de 20261002000001_init.sql, que están pensadas para Supabase Auth y no son
-- usadas por el backend actual, que autentica con JWT propios.
--
-- Solo el backend accede a esta tabla con la service role key (que omite RLS).
-- Por eso RLS queda activo sin políticas y se revocan los privilegios de los
-- roles públicos: ningún cliente puede leer ni escribir documentos directamente.
--
-- Ejecutar con la CLI de Supabase: supabase db push

create table if not exists public.app_documents (
  collection text not null,
  id text not null,
  data jsonb not null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  primary key (collection, id),
  constraint app_documents_coleccion_valida check (
    collection in ('users', 'vehicles', 'stations', 'trips', 'favorites', 'audit', 'meta')
  )
);

-- Marca de actualización en cada UPDATE. Función propia para no depender de otras migraciones.
create or replace function public.app_documents_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$;

drop trigger if exists app_documents_touch on public.app_documents;
create trigger app_documents_touch
  before update on public.app_documents
  for each row execute function public.app_documents_touch();

-- Sin políticas: con RLS activo y sin políticas, solo el rol service_role
-- (que tiene BYPASSRLS) puede acceder a la tabla.
alter table public.app_documents enable row level security;
revoke all on public.app_documents from anon, authenticated;
