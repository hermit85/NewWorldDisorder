-- Chunk 10.1: Extend submit_spot to capture region + description
-- Backward compatible: old 3-arg signature zostaje (overload), new 5-arg preferred.

CREATE OR REPLACE FUNCTION public.submit_spot(
  p_name text,
  p_lat double precision,
  p_lng double precision,
  p_region text DEFAULT '',
  p_description text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_trimmed text;
  v_trimmed_region text;
  v_trimmed_desc text;
  v_user    uuid := auth.uid();
  v_near    record;
  v_id      text;
  v_attempt integer := 0;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'code', 'unauthenticated');
  end if;

  v_trimmed := btrim(coalesce(p_name, ''));
  if char_length(v_trimmed) < 3 then
    return jsonb_build_object('ok', false, 'code', 'name_too_short');
  end if;
  if char_length(v_trimmed) > 80 then
    return jsonb_build_object('ok', false, 'code', 'name_too_long');
  end if;

  v_trimmed_region := btrim(coalesce(p_region, ''));
  v_trimmed_desc := btrim(coalesce(p_description, ''));

  if char_length(v_trimmed_desc) > 280 then
    return jsonb_build_object('ok', false, 'code', 'description_too_long');
  end if;

  -- Nearest pending-or-active spot within 500 m
  select id, name,
         (6371000 * acos(least(1.0,
           cos(radians(p_lat)) * cos(radians(center_lat)) *
           cos(radians(center_lng) - radians(p_lng)) +
           sin(radians(p_lat)) * sin(radians(center_lat))
         )))::integer as distance_m
    into v_near
    from public.spots
   where status in ('active', 'pending')
     and center_lat is not null
     and center_lng is not null
     and (6371000 * acos(least(1.0,
           cos(radians(p_lat)) * cos(radians(center_lat)) *
           cos(radians(center_lng) - radians(p_lng)) +
           sin(radians(p_lat)) * sin(radians(center_lat))
         ))) <= 500
   order by 3 asc
   limit 1;

  if v_near.id is not null then
    return jsonb_build_object(
      'ok', false,
      'code', 'duplicate_nearby',
      'near_spot_id', v_near.id,
      'near_spot_name', v_near.name,
      'distance_m', v_near.distance_m
    );
  end if;

  -- Generate submitted-<8 hex> ID
  loop
    v_attempt := v_attempt + 1;
    v_id := 'submitted-' || substr(md5(random()::text || clock_timestamp()::text), 1, 8);
    exit when not exists (select 1 from public.spots where id = v_id);
    if v_attempt >= 5 then
      raise exception 'spot_id collision after 5 attempts';
    end if;
  end loop;

  insert into public.spots (
    id, slug, name, status,
    submitted_by, center_lat, center_lng,
    is_active, region, description
  ) values (
    v_id,
    v_id,
    v_trimmed,
    'pending',
    v_user,
    p_lat,
    p_lng,
    false,
    v_trimmed_region,
    v_trimmed_desc
  );

  return jsonb_build_object('ok', true, 'spot_id', v_id);
end;
$function$;

COMMENT ON FUNCTION public.submit_spot(text, double precision, double precision, text, text) IS
  'Chunk 10.1: Extended with optional region + description params. Backward compatible defaults to empty strings.';
