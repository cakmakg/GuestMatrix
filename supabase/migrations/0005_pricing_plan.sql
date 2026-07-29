-- 0005_pricing_plan.sql
-- Tarif-Datenmodell (Basis). Nur Tarif + Kontingent-Feld; keine Zahlung (Stripe folgt später).
--   tenants.plan: 'free' (Default) | 'pro'
--
-- Voraussetzung: Basis-Migration + 0003/0004. Idempotent (add column if not exists;
-- CHECK drop + recreate). Bestandszeilen erhalten den Default 'free'.

alter table public.tenants add column if not exists plan text not null default 'free';

alter table public.tenants drop constraint if exists tenants_plan_check;
alter table public.tenants
  add constraint tenants_plan_check
  check (plan in ('free', 'pro'));
