-- ============================================================
-- WADAH KENANGAN — skema database
-- Cara pakai: buka Supabase Dashboard > SQL Editor > New query
-- Tempel SEMUA isi file ini, lalu klik "Run".
-- ============================================================

create extension if not exists pgcrypto;

-- Tabel wadah (vault). Kata sandi TIDAK disimpan polos, tapi di-hash.
create table if not exists vaults (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  password_hash text not null,
  owner_id uuid references auth.users(id),
  created_at timestamptz default now()
);

-- Tabel isi wadah (referensi ke file di Storage, bukan file itu sendiri)
create table if not exists vault_items (
  id uuid primary key default gen_random_uuid(),
  vault_id uuid references vaults(id) on delete cascade,
  storage_path text not null,
  file_type text not null,
  file_name text,
  added_by text,
  created_at timestamptz default now()
);

-- Kunci akses langsung ke tabel — semua akses HARUS lewat fungsi di bawah
alter table vaults enable row level security;
alter table vault_items enable row level security;

-- Buat wadah baru (kata sandi otomatis di-hash)
create or replace function create_vault(p_name text, p_password text)
returns uuid
language plpgsql
security definer
as $$
declare
  v_id uuid;
begin
  insert into vaults(name, password_hash, owner_id)
  values (p_name, crypt(p_password, gen_salt('bf')), auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

-- Buka wadah: cocokkan nama + kata sandi
create or replace function unlock_vault(p_name text, p_password text)
returns table(id uuid, name text)
language plpgsql
security definer
as $$
begin
  return query
  select v.id, v.name from vaults v
  where v.name = p_name and v.password_hash = crypt(p_password, v.password_hash);
end;
$$;

-- Daftar wadah milik user yang sedang login
create or replace function list_my_vaults()
returns table(id uuid, name text, created_at timestamptz)
language sql
security definer
as $$
  select id, name, created_at from vaults where owner_id = auth.uid() order by created_at desc;
$$;

-- Daftar isi sebuah wadah
create or replace function list_vault_items(p_vault_id uuid)
returns setof vault_items
language sql
security definer
as $$
  select * from vault_items where vault_id = p_vault_id order by created_at desc;
$$;

-- Tambah item ke wadah (dipanggil setelah file berhasil diunggah ke Storage)
create or replace function add_vault_item(p_vault_id uuid, p_storage_path text, p_file_type text, p_file_name text, p_added_by text)
returns uuid
language plpgsql
security definer
as $$
declare
  v_id uuid;
begin
  insert into vault_items(vault_id, storage_path, file_type, file_name, added_by)
  values (p_vault_id, p_storage_path, p_file_type, p_file_name, p_added_by)
  returning id into v_id;
  return v_id;
end;
$$;

-- Hapus item dari wadah
create or replace function delete_vault_item(p_item_id uuid)
returns void
language sql
security definer
as $$
  delete from vault_items where id = p_item_id;
$$;

grant execute on function create_vault(text, text) to authenticated;
grant execute on function unlock_vault(text, text) to authenticated;
grant execute on function list_my_vaults() to authenticated;
grant execute on function list_vault_items(uuid) to authenticated;
grant execute on function add_vault_item(uuid, text, text, text, text) to authenticated;
grant execute on function delete_vault_item(uuid) to authenticated;

-- ============================================================
-- Kebijakan Storage — jalankan setelah membuat bucket "vault-media"
-- (lihat README.md langkah 4)
-- ============================================================
create policy "authenticated upload" on storage.objects
for insert to authenticated
with check (bucket_id = 'vault-media');

create policy "authenticated read" on storage.objects
for select to authenticated
using (bucket_id = 'vault-media');

create policy "authenticated delete" on storage.objects
for delete to authenticated
using (bucket_id = 'vault-media');
