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

-- Live et cagnotte (ajoutés en V0.2).
alter table events add column if not exists cameras jsonb not null default '[]';
alter table events add column if not exists cagnotte_url text;

create index if not exists events_organizer_idx on events (organizer_id);

-- Espace caméraman (ajouté en V0.5).
alter table events add column if not exists cameraman_code text;
alter table events add column if not exists cameraman_notes text not null default '';
create index if not exists events_cameraman_code_idx on events (cameraman_code);

-- Chat / réactions et photos des invités (ajoutés en V0.3).
create table if not exists messages (
  id          bigint generated always as identity primary key,
  event_id    bigint not null references events(id) on delete cascade,
  kind        text not null check (kind in ('chat', 'reaction')),
  name        text not null,
  text        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists messages_event_idx on messages (event_id, id);

create table if not exists photos (
  id          bigint generated always as identity primary key,
  event_id    bigint not null references events(id) on delete cascade,
  name        text not null,
  url         text not null,
  created_at  timestamptz not null default now()
);
create index if not exists photos_event_idx on photos (event_id, id);

-- Livre d'or multimédia (ajouté en V0.4).
create table if not exists guestbook (
  id          bigint generated always as identity primary key,
  event_id    bigint not null references events(id) on delete cascade,
  name        text not null,
  text        text not null default '',
  photo_url   text,
  audio_url   text,
  likes       integer not null default 0,
  pinned      boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists guestbook_event_idx on guestbook (event_id, id);

create or replace function guestbook_like(entry_id bigint) returns guestbook
language sql as $$
  update guestbook set likes = likes + 1 where id = entry_id returning *;
$$;

-- Modération : auteur anonyme, blocage, signalements (ajouté en V0.6).
alter table messages add column if not exists author text;
alter table photos add column if not exists author text;
alter table guestbook add column if not exists author text;
alter table events add column if not exists blocked_authors jsonb not null default '[]';
create table if not exists reports (
  id          bigint generated always as identity primary key,
  event_id    bigint not null references events(id) on delete cascade,
  kind        text not null,
  item_id     bigint not null,
  reason      text not null default '',
  author      text,
  created_at  timestamptz not null default now()
);

-- Administration (ajouté en V0.7).
alter table organizers add column if not exists blocked boolean not null default false;
alter table events add column if not exists suspended boolean not null default false;
create table if not exists settings (key text primary key, value jsonb);

-- Spectateurs du live (ajouté en V0.8).
create table if not exists presence (
  event_id   bigint not null references events(id) on delete cascade,
  client_id  text not null,
  seen_at    timestamptz not null default now(),
  primary key (event_id, client_id)
);

-- Sécurité : RLS activé sans règle = aucune lecture/écriture avec la clé publique (anon).
-- Seul le serveur, avec la clé service_role, accède aux données.
alter table organizers enable row level security;
alter table events enable row level security;
alter table messages enable row level security;
alter table photos enable row level security;
alter table guestbook enable row level security;
alter table reports enable row level security;
alter table settings enable row level security;
alter table presence enable row level security;

-- Bucket public pour les photos (couvertures et faire-part).
insert into storage.buckets (id, name, public)
values ('evenements', 'evenements', true)
on conflict (id) do nothing;
