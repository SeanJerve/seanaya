-- Daily location each member shares with their partner.
-- One row per (space, slot); a device that re-claims a slot simply overwrites it.
-- Safe to run more than once.

create table if not exists public.member_locations (
  relationship_id uuid not null references public.relationships (id) on delete cascade,
  slot text not null check (slot in ('a', 'b')),
  city text not null,
  lat double precision not null,
  lng double precision not null,
  updated_at timestamptz not null default now(),
  primary key (relationship_id, slot)
);

alter table public.member_locations enable row level security;

-- Either member of the space can read both rows.
drop policy if exists "members read locations" on public.member_locations;
create policy "members read locations"
  on public.member_locations for select
  using (
    exists (
      select 1 from public.relationships r
      where r.id = member_locations.relationship_id
        and auth.uid() in (r.user_a_id, r.user_b_id)
    )
  );

-- Each member writes only the row for the slot they currently hold.
drop policy if exists "member writes own slot" on public.member_locations;
create policy "member writes own slot"
  on public.member_locations for insert
  with check (
    exists (
      select 1 from public.relationships r
      where r.id = member_locations.relationship_id
        and (
          (member_locations.slot = 'a' and r.user_a_id = auth.uid())
          or (member_locations.slot = 'b' and r.user_b_id = auth.uid())
        )
    )
  );

drop policy if exists "member updates own slot" on public.member_locations;
create policy "member updates own slot"
  on public.member_locations for update
  using (
    exists (
      select 1 from public.relationships r
      where r.id = member_locations.relationship_id
        and (
          (member_locations.slot = 'a' and r.user_a_id = auth.uid())
          or (member_locations.slot = 'b' and r.user_b_id = auth.uid())
        )
    )
  );

-- Live updates on the partner's screen (only added if not already there).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'member_locations'
  ) then
    alter publication supabase_realtime add table public.member_locations;
  end if;
end $$;
