-- =============================================================================
-- Migration 003: append-only audit log.
--
-- Records who did or attempted what, and when. Append-only by construction:
-- authenticated users can insert rows about themselves; only staff (aal2) can
-- read; nobody can update or delete (no policies exist for those verbs, and
-- privileges are revoked below for defence in depth).
--
-- Honest limitation, stated for the record: rows are written by the client, so
-- a hostile client could decline to log. The audit trail is reliable for normal
-- operation and for staff actions; database-side triggers add server-enforced
-- entries for timesheet decisions below.
-- =============================================================================

create table public.audit_log (
    id          bigint generated always as identity primary key,
    at          timestamptz not null default now(),
    actor       uuid references public.profiles (id) on delete set null,
    action      text not null,          -- e.g. 'contract.download', 'timesheet.approve', 'access.denied'
    entity      text not null default '',
    entity_id   text not null default '',
    detail      jsonb not null default '{}'::jsonb
);

create index on public.audit_log (at desc);
create index on public.audit_log (actor);
create index on public.audit_log (action);

alter table public.audit_log enable row level security;

-- Insert: any authenticated user, but only as themselves.
create policy "audit: insert self" on public.audit_log
    for insert to authenticated
    with check (actor = auth.uid());

-- Read: staff only (is_staff already requires aal2).
create policy "audit: staff read" on public.audit_log
    for select using (public.is_staff());

-- No update/delete policies, and belt-and-braces privilege revocation.
revoke update, delete on public.audit_log from authenticated, anon;

-- -----------------------------------------------------------------------------
-- Server-enforced audit entries for timesheet decisions: written by trigger, so
-- they exist regardless of client behaviour.
-- -----------------------------------------------------------------------------
create or replace function public.audit_timesheet_decision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.status is distinct from old.status and new.status in ('approved', 'rejected') then
        insert into public.audit_log (actor, action, entity, entity_id, detail)
        values (
            auth.uid(),
            'timesheet.' || new.status,
            'timesheet',
            new.id::text,
            jsonb_build_object('week_start', new.week_start, 'candidate_id', new.candidate_id)
        );
    end if;
    return new;
end;
$$;

create trigger trg_audit_timesheet_decision
    after update on public.timesheets
    for each row execute function public.audit_timesheet_decision();
