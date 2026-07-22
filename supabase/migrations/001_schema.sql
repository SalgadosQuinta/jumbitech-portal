-- =============================================================================
-- JumbiTech Placement Platform — Schema
-- Migration 001: core tables
--
-- Design notes
--  * Three roles: 'candidate', 'staff', 'client'. Role lives on the profile row,
--    mirrored into the JWT via a custom claim (see 002) so RLS can read it cheaply.
--  * Every candidate-facing table carries the owning candidate's user id so
--    row-level security can restrict reads to "your own rows" at the database
--    layer, not in application code.
--  * Timesheet lifecycle is an enum, so the approval workflow is explicit and
--    queryable. Approval mode lives on the placement.
-- =============================================================================

-- Roles a platform user can hold.
create type user_role as enum ('candidate', 'staff', 'client');

-- How a placement's timesheets get approved.
create type approval_mode as enum ('jumbitech', 'client', 'auto');

-- Timesheet states.
create type timesheet_status as enum ('draft', 'submitted', 'approved', 'rejected', 'locked');

-- -----------------------------------------------------------------------------
-- profiles: one row per auth user, holding role and display details.
-- Linked 1:1 to auth.users. Created automatically on signup (trigger in 002).
-- -----------------------------------------------------------------------------
create table public.profiles (
    id           uuid primary key references auth.users (id) on delete cascade,
    role         user_role   not null default 'candidate',
    full_name    text        not null default '',
    email        text        not null,
    -- For client users: which client organisation they belong to.
    client_id    uuid,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- clients: the end-client organisations candidates are placed into.
-- -----------------------------------------------------------------------------
create table public.clients (
    id           uuid primary key default gen_random_uuid(),
    name         text        not null,
    created_at   timestamptz not null default now()
);

-- Now that clients exists, wire the profile FK.
alter table public.profiles
    add constraint profiles_client_fk
    foreign key (client_id) references public.clients (id) on delete set null;

-- -----------------------------------------------------------------------------
-- placements: a candidate engaged with a client, with commercial terms.
-- -----------------------------------------------------------------------------
create table public.placements (
    id             uuid primary key default gen_random_uuid(),
    candidate_id   uuid not null references public.profiles (id) on delete cascade,
    client_id      uuid references public.clients (id) on delete set null,
    role_title     text not null default '',
    approval_mode  approval_mode not null default 'jumbitech',
    day_rate       numeric(10,2),
    currency       text not null default 'GBP',
    start_date     date,
    end_date       date,
    active         boolean not null default true,
    created_at     timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- candidate_profiles: richer profile info candidates maintain about themselves.
-- Kept separate from the auth profile so it can grow without touching auth.
-- -----------------------------------------------------------------------------
create table public.candidate_profiles (
    candidate_id uuid primary key references public.profiles (id) on delete cascade,
    headline     text not null default '',
    phone        text not null default '',
    location     text not null default '',
    skills       text not null default '',
    bio          text not null default '',
    updated_at   timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- timesheets: one row per candidate per placement per ISO week.
-- Hours stored as a jsonb map { "mon": 8, "tue": 7.5, ... }.
-- -----------------------------------------------------------------------------
create table public.timesheets (
    id             uuid primary key default gen_random_uuid(),
    placement_id   uuid not null references public.placements (id) on delete cascade,
    candidate_id   uuid not null references public.profiles (id) on delete cascade,
    week_start     date not null,               -- Monday of the ISO week.
    hours          jsonb not null default '{}'::jsonb,
    total_hours    numeric(6,2) not null default 0,
    notes          text not null default '',
    status         timesheet_status not null default 'submitted',
    decided_by     uuid references public.profiles (id),
    decided_at     timestamptz,
    decision_note  text not null default '',
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now(),
    unique (placement_id, week_start)
);

-- -----------------------------------------------------------------------------
-- contracts: metadata for a stored PDF. The file itself lives in the private
-- 'contracts' storage bucket; this table records who it belongs to.
-- -----------------------------------------------------------------------------
create table public.contracts (
    id            uuid primary key default gen_random_uuid(),
    candidate_id  uuid not null references public.profiles (id) on delete cascade,
    placement_id  uuid references public.placements (id) on delete set null,
    label         text not null,
    storage_path  text not null,     -- path within the 'contracts' bucket.
    uploaded_by   uuid references public.profiles (id),
    created_at    timestamptz not null default now()
);

-- Helpful indexes for the common access patterns.
create index on public.placements (candidate_id);
create index on public.placements (client_id);
create index on public.timesheets (candidate_id);
create index on public.timesheets (placement_id);
create index on public.timesheets (status);
create index on public.contracts (candidate_id);
