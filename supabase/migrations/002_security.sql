-- =============================================================================
-- Migration 002: security — role helper, RLS policies, signup trigger, storage
--
-- The heart of the platform's security. Access rules live in the database so
-- they hold no matter what the front-end does. A compromised or buggy client
-- still cannot read another candidate's timesheet, because Postgres refuses.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- MFA enforcement helper. True only when the caller's JWT was issued after a
-- verified second factor (authenticator assurance level 2). Sensitive tables
-- require this, so a password-only session cannot read data via the REST API,
-- regardless of what any front-end does.
-- -----------------------------------------------------------------------------
create or replace function public.is_aal2()
returns boolean
language sql
stable
as $$
    select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;

-- -----------------------------------------------------------------------------
-- Role helper. Reads the caller's role from their profile. SECURITY DEFINER so
-- it can read profiles even under RLS, marked STABLE for query planning.
-- -----------------------------------------------------------------------------
create or replace function public.current_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
    select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (select 1 from public.profiles where id = auth.uid() and role = 'staff')
           and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;

-- The client organisation the caller belongs to (null unless a client user).
create or replace function public.current_client_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
    select client_id from public.profiles where id = auth.uid();
$$;

-- -----------------------------------------------------------------------------
-- Signup trigger: create a profile row automatically for every new auth user.
-- New signups default to 'candidate'. Staff and client roles are assigned by a
-- staff member afterwards (candidates can never self-elevate: the role column
-- is not writable by candidates, enforced by policy below).
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (id, email, full_name)
    values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'full_name', ''));
    return new;
end;
$$;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- =============================================================================
-- Enable RLS on every table. Default-deny: nothing is readable until a policy
-- grants it.
-- =============================================================================
alter table public.profiles           enable row level security;
alter table public.clients            enable row level security;
alter table public.placements         enable row level security;
alter table public.candidate_profiles enable row level security;
alter table public.timesheets         enable row level security;
alter table public.contracts          enable row level security;

-- -------------------------------------------------------------- profiles
-- You can always read and update your own profile. Staff can read all.
-- Crucially, the role column is protected: a non-staff user updating their own
-- profile cannot change their role (enforced by the with-check below).
create policy "profiles: read own" on public.profiles
    for select using (id = auth.uid());

create policy "profiles: staff read all" on public.profiles
    for select using (public.is_staff());

create policy "profiles: update own non-role" on public.profiles
    for update using (id = auth.uid())
    with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));

create policy "profiles: staff manage" on public.profiles
    for all using (public.is_staff()) with check (public.is_staff());

-- -------------------------------------------------------------- clients
create policy "clients: staff full" on public.clients
    for all using (public.is_staff()) with check (public.is_staff());

-- A client user can see their own organisation. Candidates see clients they are
-- placed with (needed to show the client name on their placement).
create policy "clients: client sees own" on public.clients
    for select using (id = public.current_client_id() and public.is_aal2());

create policy "clients: candidate sees placed" on public.clients
    for select using (
        exists (
            select 1 from public.placements p
            where p.client_id = clients.id and p.candidate_id = auth.uid()
        )
    );

-- -------------------------------------------------------------- placements
create policy "placements: staff full" on public.placements
    for all using (public.is_staff()) with check (public.is_staff());

create policy "placements: candidate sees own" on public.placements
    for select using (candidate_id = auth.uid() and public.is_aal2());

create policy "placements: client sees theirs" on public.placements
    for select using (client_id = public.current_client_id() and public.is_aal2());

-- ---------------------------------------------------- candidate_profiles
create policy "cprofiles: candidate manage own" on public.candidate_profiles
    for all using (candidate_id = auth.uid() and public.is_aal2()) with check (candidate_id = auth.uid() and public.is_aal2());

create policy "cprofiles: staff read" on public.candidate_profiles
    for select using (public.is_staff());

-- A client can view the profile of a candidate placed with them.
create policy "cprofiles: client sees placed" on public.candidate_profiles
    for select using (
        exists (
            select 1 from public.placements p
            where p.candidate_id = candidate_profiles.candidate_id
              and p.client_id = public.current_client_id()
        ) and public.is_aal2()
    );

-- -------------------------------------------------------------- timesheets
-- Candidate: read own, and insert/update own while not yet approved/locked.
create policy "timesheets: candidate read own" on public.timesheets
    for select using (candidate_id = auth.uid() and public.is_aal2());

create policy "timesheets: candidate insert own" on public.timesheets
    for insert with check (candidate_id = auth.uid() and public.is_aal2());

create policy "timesheets: candidate edit own unapproved" on public.timesheets
    for update using (candidate_id = auth.uid() and public.is_aal2() and status in ('draft', 'submitted', 'rejected'))
    with check (candidate_id = auth.uid());

-- Staff: full control.
create policy "timesheets: staff full" on public.timesheets
    for all using (public.is_staff()) with check (public.is_staff());

-- Client: read timesheets for their placements, and approve/reject them
-- (update limited to their own placements).
create policy "timesheets: client read theirs" on public.timesheets
    for select using (
        exists (
            select 1 from public.placements p
            where p.id = timesheets.placement_id and p.client_id = public.current_client_id()
        ) and public.is_aal2()
    );

create policy "timesheets: client decide theirs" on public.timesheets
    for update using (
        exists (
            select 1 from public.placements p
            where p.id = timesheets.placement_id
              and p.client_id = public.current_client_id()
              and p.approval_mode = 'client'
        ) and public.is_aal2()
    )
    with check (true);

-- -------------------------------------------------------------- contracts
create policy "contracts: candidate read own" on public.contracts
    for select using (candidate_id = auth.uid() and public.is_aal2());

create policy "contracts: staff full" on public.contracts
    for all using (public.is_staff()) with check (public.is_staff());

create policy "contracts: client sees placed" on public.contracts
    for select using (
        exists (
            select 1 from public.placements p
            where p.candidate_id = contracts.candidate_id and p.client_id = public.current_client_id()
        ) and public.is_aal2()
    );

-- =============================================================================
-- Storage: a private bucket for contract PDFs. Files are never public; the app
-- requests short-lived signed URLs. RLS on storage.objects mirrors the contract
-- table rules: a candidate can read only files whose path begins with their uid.
--
-- Convention: contract files are stored at  <candidate_uid>/<contract_id>.pdf
-- so the first path segment is the owner, which the policies check.
-- =============================================================================
insert into storage.buckets (id, name, public)
values ('contracts', 'contracts', false)
on conflict (id) do nothing;

create policy "contracts storage: staff all" on storage.objects
    for all using (bucket_id = 'contracts' and public.is_staff())
    with check (bucket_id = 'contracts' and public.is_staff());

create policy "contracts storage: candidate read own" on storage.objects
    for select using (
        bucket_id = 'contracts'
        and (storage.foldername(name))[1] = auth.uid()::text
        and public.is_aal2()
    );

create policy "contracts storage: client read placed" on storage.objects
    for select using (
        bucket_id = 'contracts'
        and exists (
            select 1 from public.placements p
            where p.candidate_id::text = (storage.foldername(name))[1]
              and p.client_id = public.current_client_id()
        ) and public.is_aal2()
    );
