  -- Album pages and items were readable without signing in. Lock them to the two members.
  
  alter table public.album_pages enable row level security;
  alter table public.album_items enable row level security;
  
  drop policy if exists "members manage album pages" on public.album_pages;
  create policy "members manage album pages"
    on public.album_pages for all
    using (
      exists (
        select 1 from public.relationships r
        where r.id = album_pages.relationship_id
          and auth.uid() in (r.user_a_id, r.user_b_id)
      )
    )
    with check (
      exists (
        select 1 from public.relationships r
        where r.id = album_pages.relationship_id
          and auth.uid() in (r.user_a_id, r.user_b_id)
      )
    );
  
  drop policy if exists "members manage album items" on public.album_items;
  create policy "members manage album items"
    on public.album_items for all
    using (
      exists (
        select 1 from public.album_pages p
        join public.relationships r on r.id = p.relationship_id
        where p.id = album_items.page_id
          and auth.uid() in (r.user_a_id, r.user_b_id)
      )
    )
    with check (
      exists (
        select 1 from public.album_pages p
        join public.relationships r on r.id = p.relationship_id
        where p.id = album_items.page_id
          and auth.uid() in (r.user_a_id, r.user_b_id)
      )
    );
  
  -- Review and drop any older permissive policies on these tables, e.g.:
  --   select policyname, cmd, qual from pg_policies where tablename in ('album_pages','album_items');
