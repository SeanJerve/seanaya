
CREATE OR REPLACE FUNCTION public.notify_partner()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  partner UUID;
  rel RECORD;
  actor UUID;
  kind_txt TEXT := TG_ARGV[0];
BEGIN
  actor := COALESCE(
    CASE WHEN TG_TABLE_NAME IN ('memories','events','trips') THEN NEW.created_by END,
    CASE WHEN TG_TABLE_NAME = 'notes' THEN NEW.author_id END,
    CASE WHEN TG_TABLE_NAME = 'songs' THEN NEW.added_by END
  );
  SELECT * INTO rel FROM public.relationships WHERE id = NEW.relationship_id;
  IF rel IS NULL THEN RETURN NEW; END IF;
  partner := CASE WHEN rel.user_a_id = actor THEN rel.user_b_id ELSE rel.user_a_id END;
  IF partner IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.notifications (relationship_id, user_id, kind, ref_id, read)
  VALUES (NEW.relationship_id, partner, kind_txt::public.notification_kind, NEW.id, false);
  RETURN NEW;
END; $$;
