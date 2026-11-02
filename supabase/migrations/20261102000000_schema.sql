-- Shalti catalog schema. Run once in the Supabase SQL editor (or via scripts/setup-supabase.js).
-- Each table stores the item as a JSON document plus its sort order; the app maps rows <-> objects.
-- Access model (no public access at all):
--   shop user  (app_metadata.role = 'shop')  -> read catalog
--   admin user (app_metadata.role = 'admin') -> read + write everything

create or replace function public.is_admin() returns boolean
language sql stable as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
$$;

create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'
);

create table if not exists public.categories (
  id text primary key,
  sort int not null default 0,
  data jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

create table if not exists public.brands (like public.categories including all);
create table if not exists public.products (like public.categories including all);

-- Prices live apart so shop screens can't read them while "show prices" is off.
create table if not exists public.product_prices (
  product_id text primary key references public.products (id) on delete cascade,
  price numeric not null
);

do $$
declare t text;
begin
  foreach t in array array['settings', 'categories', 'brands', 'products', 'product_prices'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists admin_all on public.%I', t);
    execute format('create policy admin_all on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
  foreach t in array array['settings', 'categories', 'brands', 'products'] loop
    execute format('drop policy if exists signed_in_read on public.%I', t);
    execute format('create policy signed_in_read on public.%I for select to authenticated using (true)', t);
  end loop;
end $$;

drop policy if exists shop_read_prices on public.product_prices;
create policy shop_read_prices on public.product_prices for select to authenticated
  using (coalesce((select (data ->> 'showPrices')::boolean from public.settings where id = 1), false));

insert into public.settings (id, data)
values (1, '{"showPrices": false, "idleSeconds": 60, "currency": "₪"}')
on conflict (id) do nothing;

-- Live updates to shop screens.
do $$
declare t text;
begin
  foreach t in array array['settings', 'categories', 'brands', 'products', 'product_prices'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Images: public-read bucket (product photos aren't secret, and public URLs cache well); admin-only writes.
insert into storage.buckets (id, name, public) values ('images', 'images', true) on conflict (id) do nothing;
drop policy if exists images_admin_write on storage.objects;
create policy images_admin_write on storage.objects for all to authenticated
  using (bucket_id = 'images' and public.is_admin())
  with check (bucket_id = 'images' and public.is_admin());
