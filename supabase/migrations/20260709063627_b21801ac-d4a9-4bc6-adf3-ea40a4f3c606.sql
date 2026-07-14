
GRANT EXECUTE ON FUNCTION public.is_relationship_member(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.current_relationship_id() TO authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_set_updated_at() FROM PUBLIC, anon, authenticated;
