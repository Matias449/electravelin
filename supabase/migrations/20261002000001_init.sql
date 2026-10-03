-- Electravelin — esquema inicial (MVP v2)
-- Ejecutar con la CLI de Supabase: supabase db push
-- Requiere la extensión pgcrypto para gen_random_uuid().

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────────────────────
-- Perfiles (extienden auth.users)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null,
  email text not null unique,
  rol text not null default 'usuario' check (rol in ('usuario', 'admin')),
  vehiculo_favorito_id text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and rol = 'admin'
  );
$$;

-- Crea el perfil automáticamente al registrarse en Supabase Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nombre, email)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'nombre', ''), split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Evita que un usuario no administrador cambie su propio rol.
-- auth.uid() nulo corresponde al service role o a SQL administrativo.
create or replace function public.protect_rol()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.rol <> old.rol and auth.uid() is not null and not public.is_admin() then
    raise exception 'Solo un administrador puede cambiar el rol.';
  end if;
  new.actualizado_en := now();
  return new;
end;
$$;

drop trigger if exists profiles_protect_rol on public.profiles;
create trigger profiles_protect_rol
  before update on public.profiles
  for each row execute function public.protect_rol();

-- ─────────────────────────────────────────────────────────────────────────────
-- Catálogo
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.vehicles (
  id text primary key,
  modelo text not null,
  marca text not null,
  bateria_utilizable_kwh numeric not null check (bateria_utilizable_kwh > 0),
  consumo_referencia_kwh_100km numeric not null check (consumo_referencia_kwh_100km > 0),
  potencia_carga_maxima_kw numeric not null check (potencia_carga_maxima_kw > 0),
  conectores text[] not null check (array_length(conectores, 1) > 0),
  imagen_url text,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table if not exists public.stations (
  id text primary key,
  nombre text not null,
  ciudad_id text not null,
  ciudad text not null,
  region text,
  operador text not null,
  latitud numeric not null check (latitud between -56 and -17),
  longitud numeric not null check (longitud between -76 and -66),
  conectores text[] not null check (array_length(conectores, 1) > 0),
  potencia_maxima_kw numeric not null check (potencia_maxima_kw > 0),
  tarifa_clp_kwh numeric check (tarifa_clp_kwh >= 0),
  tipo_tarifa text not null default 'CLP/kWh',
  disponible boolean not null default true,
  verificada boolean not null default false,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Cuenta: viajes y favoritos
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  origen text not null,
  destino text not null,
  vehiculo_id text not null,
  soc_inicial numeric not null check (soc_inicial between 0 and 100),
  resumen jsonb not null,
  paradas jsonb not null default '[]'::jsonb,
  geometry jsonb,
  advertencias jsonb not null default '[]'::jsonb,
  creado_en timestamptz not null default now()
);

create index if not exists trips_user_creado_idx on public.trips (user_id, creado_en desc);

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  tipo text not null check (tipo in ('vehiculo', 'estacion')),
  referencia_id text not null,
  creado_en timestamptz not null default now(),
  unique (user_id, tipo, referencia_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Auditoría
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  accion text not null,
  entidad text not null,
  entidad_id text,
  detalle jsonb,
  request_id text,
  creado_en timestamptz not null default now()
);

create index if not exists audit_log_creado_idx on public.audit_log (creado_en desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.vehicles enable row level security;
alter table public.stations enable row level security;
alter table public.trips enable row level security;
alter table public.favorites enable row level security;
alter table public.audit_log enable row level security;

-- Perfiles: cada usuario ve y edita el suyo; los admin ven todos.
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (auth.uid() = id or public.is_admin());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());

-- Catálogo: lectura pública de registros activos; escritura solo admin.
drop policy if exists vehicles_select_public on public.vehicles;
create policy vehicles_select_public on public.vehicles
  for select using (activo or public.is_admin());

drop policy if exists vehicles_admin_write on public.vehicles;
create policy vehicles_admin_write on public.vehicles
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists stations_select_public on public.stations;
create policy stations_select_public on public.stations
  for select using (disponible or public.is_admin());

drop policy if exists stations_admin_write on public.stations;
create policy stations_admin_write on public.stations
  for all using (public.is_admin()) with check (public.is_admin());

-- Viajes: solo el dueño.
drop policy if exists trips_owner_all on public.trips;
create policy trips_owner_all on public.trips
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Favoritos: solo el dueño.
drop policy if exists favorites_owner_all on public.favorites;
create policy favorites_owner_all on public.favorites
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Auditoría: la escribe el backend (service role) y la lee un admin.
drop policy if exists audit_admin_read on public.audit_log;
create policy audit_admin_read on public.audit_log
  for select using (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- updated_at automático
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

drop trigger if exists vehicles_touch on public.vehicles;
create trigger vehicles_touch before update on public.vehicles
  for each row execute function public.touch_updated_at();

drop trigger if exists stations_touch on public.stations;
create trigger stations_touch before update on public.stations
  for each row execute function public.touch_updated_at();
