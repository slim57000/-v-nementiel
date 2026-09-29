-- À exécuter une fois dans Supabase : SQL Editor → New query → coller → Run.

create table if not exists organizers (
  id          bigint generated always as identity primary key,
  email       text not null unique,
  login_code  text not null,
  created_at  timestamptz not null default now()
);

create table if not exists events (
  id            bigint generated always as identity primary key,
  organizer_id  bigint not null references organizers(id) on delete cascade,
  slug          text not null unique,
  name          text not null,
  type          text not null,
  date          text not null,          -- AAAA-MM-JJ
  time          text not null,          -- HH:MM
  location      text not null,
  description   text not null default '',
  cover         text,
  visibility    text not null default 'public' check (visibility in ('public', 'private')),
  access_code   text not null,
  invite_style  text not null default 'classique',
  invite        jsonb not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists events_organizer_idx on events (organizer_id);

-- Sécurité : RLS activé sans règle = aucune lecture/écriture avec la clé publique (anon).
-- Seul le serveur, avec la clé service_role, accède aux données.
alter table organizers enable row level security;
alter table events enable row level security;

-- Bucket public pour les photos (couvertures et faire-part).
insert into storage.buckets (id, name, public)
values ('evenements', 'evenements', true)
on conflict (id) do nothing;
