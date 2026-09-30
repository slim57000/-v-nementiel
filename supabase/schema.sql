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

-- Réseau : profil, amis, blocages, messages privés, favoris, historique (ajouté en V0.9).
alter table organizers add column if not exists display_name text not null default '';
alter table organizers add column if not exists avatar_url text;
create table if not exists friends (
  user_id bigint not null references organizers(id) on delete cascade,
  friend_id bigint not null references organizers(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id)
);
create table if not exists blocks (
  blocker_id bigint not null references organizers(id) on delete cascade,
  blocked_id bigint not null references organizers(id) on delete cascade,
  primary key (blocker_id, blocked_id)
);
create table if not exists dms (
  id bigint generated always as identity primary key,
  sender_id bigint not null references organizers(id) on delete cascade,
  recipient_id bigint not null references organizers(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);
create index if not exists dms_pair_idx on dms (sender_id, recipient_id, id);
create table if not exists favorites (
  user_id bigint not null references organizers(id) on delete cascade,
  event_id bigint not null references events(id) on delete cascade,
  primary key (user_id, event_id)
);
create table if not exists history (
  user_id bigint not null references organizers(id) on delete cascade,
  event_id bigint not null references events(id) on delete cascade,
  visited_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

-- Réponses aux messages du livre d'or (ajouté en V1.1).
alter table guestbook add column if not exists replies jsonb not null default '[]';

-- Limites de débit partagées (anti-spam, anti-bruteforce), ajouté en V1.2.
create table if not exists rate_limits (key text primary key, n integer not null, reset_at timestamptz not null);
create or replace function bump_limit(k text, window_ms bigint) returns integer
language sql as $$
  insert into rate_limits as r (key, n, reset_at) values (k, 1, now() + make_interval(secs => window_ms / 1000.0))
  on conflict (key) do update set
    n = case when r.reset_at < now() then 1 else r.n + 1 end,
    reset_at = case when r.reset_at < now() then now() + make_interval(secs => window_ms / 1000.0) else r.reset_at end
  returning n;
$$;
alter table rate_limits enable row level security;

-- Notifications push (ajouté en V1.2) : owner = « org:<id> » (compte) ou « gid:<id> » (invité anonyme).
create table if not exists push_subscriptions (
  endpoint text primary key,
  owner text not null,
  sub jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists push_owner_idx on push_subscriptions (owner);
alter table push_subscriptions enable row level security;

-- Invitations par email avec suivi (ajouté en V1.2).
create table if not exists invites (
  token text primary key,
  event_id bigint not null references events(id) on delete cascade,
  email text not null,
  sent_at timestamptz not null default now(),
  seen_at timestamptz,
  joined_at timestamptz
);
create index if not exists invites_event_idx on invites (event_id);
alter table invites enable row level security;

-- Stories temporaires (24 h) façon Instagram (ajouté en V1.3).
alter table photos add column if not exists story boolean not null default false;
alter table photos add column if not exists caption text;

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
alter table friends enable row level security;
alter table blocks enable row level security;
alter table dms enable row level security;
alter table favorites enable row level security;
alter table history enable row level security;

-- Bucket public pour les photos (couvertures et faire-part).
insert into storage.buckets (id, name, public)
values ('evenements', 'evenements', true)
on conflict (id) do nothing;
