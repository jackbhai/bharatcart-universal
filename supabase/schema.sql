-- ============================================================================
-- BharatCart — database schema
-- Works on: Supabase (SQL editor), Neon (SQL editor), Vercel Postgres,
--           any PostgreSQL 14+.
--
-- Column names are quoted camelCase ("createdAt") so rows map 1:1 onto the
-- JavaScript objects the app already uses — no translation layer needed.
--
-- SECURITY NOTE (read before going live):
--   Row Level Security is NOT enabled by this file. That is deliberate: the
--   correct policies depend on YOUR auth setup (Supabase Auth, Firebase Auth,
--   or your own backend). For a storefront that writes through the anon key,
--   enable RLS and add policies that fit your threat model — see the commented
--   example at the bottom. Never expose the service_role key to the browser.
-- ============================================================================

-- Run this once per database. If your host needs extensions approved first,
-- run the CREATE EXTENSION line in their dashboard SQL editor.
create extension if not exists "pg_trgm";

create table if not exists "products" (
  "id"          text primary key,
  "name"        text not null,
  "slug"        text,
  "brand"       text,
  "category"    text,
  "subCategory" text,
  "description" text,
  "price"       numeric not null default 0,
  "mrp"         numeric,
  "currency"    text default 'INR',
  "stock"       integer not null default 0,
  "sku"         text,
  "status"      text not null default 'draft',   -- draft | active | archived
  "images"      jsonb not null default '[]',
  "variants"    jsonb not null default '[]',
  "attributes"  jsonb not null default '{}',
  "tags"        jsonb not null default '[]',
  "rating"      numeric default 0,
  "weightG"     integer,
  "hsn"         text,
  "gst"         numeric,
  "vertical"    text,                            -- fashion | grocery | dairy | …
  "createdAt"   timestamptz not null default now(),
  "updatedAt"   timestamptz not null default now()
);
create index if not exists "products_status_idx"   on "products" ("status");
create index if not exists "products_category_idx" on "products" ("category");
create index if not exists "products_name_trgm"    on "products" using gin ("name" gin_trgm_ops);

create table if not exists "categories" (
  "id"          text primary key,
  "name"        text not null,
  "parentId"    text references "categories"("id") on delete set null,
  "description" text,
  "image"       text,
  "sortOrder"   integer not null default 0,
  "visible"     boolean not null default true,
  "vertical"    text,
  "createdAt"   timestamptz not null default now()
);

create table if not exists "customers" (
  "id"          text primary key,
  "name"        text,
  "email"       text,
  "phone"       text,
  "addresses"   jsonb not null default '[]',
  "tags"        jsonb not null default '[]',
  "totalSpent"  numeric not null default 0,
  "ordersCount" integer not null default 0,
  "meta"        jsonb not null default '{}',
  "createdAt"   timestamptz not null default now(),
  "updatedAt"   timestamptz not null default now()
);
create unique index if not exists "customers_email_uidx" on "customers" ("email") where "email" is not null;

create table if not exists "orders" (
  "id"              text primary key,
  "customerId"      text references "customers"("id") on delete set null,
  "status"          text not null default 'pending',
  -- pending | confirmed | packed | shipped | delivered | cancelled | returned
  "paymentStatus"   text not null default 'unpaid',   -- unpaid | paid | refunded | failed
  "paymentMethod"   text,
  "subtotal"        numeric not null default 0,
  "discount"        numeric not null default 0,
  "shipping"        numeric not null default 0,
  "tax"             numeric not null default 0,
  "total"           numeric not null default 0,
  "currency"        text default 'INR',
  "shippingAddress" jsonb,
  "billingAddress"  jsonb,
  "notes"           text,
  "meta"            jsonb not null default '{}',
  "createdAt"       timestamptz not null default now(),
  "updatedAt"       timestamptz not null default now()
);
create index if not exists "orders_status_idx"    on "orders" ("status");
create index if not exists "orders_customer_idx"  on "orders" ("customerId");
create index if not exists "orders_created_idx"   on "orders" ("createdAt" desc);

create table if not exists "order_items" (
  "id"        text primary key,
  "orderId"   text not null references "orders"("id") on delete cascade,
  "productId" text,
  "sku"       text,
  "name"      text not null,
  "qty"       integer not null default 1,
  "price"     numeric not null default 0,
  "mrp"       numeric,
  "meta"      jsonb not null default '{}'
);
create index if not exists "order_items_order_idx" on "order_items" ("orderId");

create table if not exists "settings" (
  "key"       text primary key,
  "value"     jsonb not null,
  "updatedAt" timestamptz not null default now()
);

-- ============================================================================
-- Example RLS hardening (Supabase). Adapt to your auth model — this is a
-- starting point, not a finished policy set.
-- ============================================================================
-- alter table "products"   enable row level security;
-- alter table "categories" enable row level security;
-- alter table "orders"     enable row level security;
-- alter table "order_items" enable row level security;
-- alter table "customers"  enable row level security;
-- alter table "settings"   enable row level security;
--
-- -- Public read of the catalogue, writes require a signed-in user:
-- create policy "catalogue public read" on "products"   for select using (true);
-- create policy "catalogue public read" on "categories" for select using (true);
-- create policy "catalogue staff write" on "products"   for all using (auth.role() = 'authenticated');
-- create policy "catalogue staff write" on "categories" for all using (auth.role() = 'authenticated');
--
-- -- Orders: anyone can create (checkout), only staff read/update:
-- create policy "orders insert"       on "orders"      for insert with check (true);
-- create policy "order items insert"  on "order_items" for insert with check (true);
-- create policy "orders staff"        on "orders"      for all using (auth.role() = 'authenticated');
-- create policy "order items staff"  on "order_items" for all using (auth.role() = 'authenticated');
--
-- -- Customers and settings: staff only.
-- create policy "customers staff" on "customers" for all using (auth.role() = 'authenticated');
-- create policy "settings staff"  on "settings"  for all using (auth.role() = 'authenticated');
