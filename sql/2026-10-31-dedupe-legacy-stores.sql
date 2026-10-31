-- Deactivate legacy short-name / UUID-slug website_stores rows that duplicate
-- the Fab Clean–prefixed catalog (Pollachi, Kinathukadavu, Udumalpet, MCET).
-- Safe to run repeatedly. Also re-upserts the four canonical customer branches.

-- 1) Hide non-canonical active rows (UUID slugs, short city names, MCET, etc.)
update website_stores
set
  is_active = false,
  updated_at = now()
where is_active = true
  and (
    slug not in ('pollachi', 'suleeshwaranpatti', 'udumalpet', 'kinathukadavu')
    or name !~* '^Fab[[:space:]]*Clean[[:space:]]*-'
  );

-- 2) Ensure the four Fab Clean–prefixed branches are active with current details
insert into website_stores (
  slug,
  name,
  address,
  phone,
  email,
  latitude,
  longitude,
  coverage_radius_km,
  map_href,
  sort_order,
  is_active
)
values
  (
    'pollachi',
    'Fab Clean - Pollachi',
    'No 16, Venketaramana Round Road, opp. to HDFC Bank, Pollachi, Tamil Nadu 642002',
    '93630 59595',
    'pollachi@myfabclean.com',
    10.667749,
    77.011954,
    10,
    'https://maps.app.goo.gl/hGJHdkEraCXsbsgD6',
    1,
    true
  ),
  (
    'suleeshwaranpatti',
    'Fab Clean - Suleeshwaranpatti',
    '162, Kottur Road, opp. to Makkal Marundhagam, near to Nandhini Mahal, Suleshwaranpatti, Pollachi, Tamil Nadu 642006',
    '93630 59595',
    'suleeshwaranpatti@myfabclean.com',
    10.639843,
    77.007228,
    9,
    'https://maps.app.goo.gl/c5dGSpTPJnEvTGHNA',
    2,
    true
  ),
  (
    'udumalpet',
    'Fab Clean - Udumalaipettai',
    'First floor, No 79/7, Main Rd, opp. to Indian Bank, Aishwarya Nagar, Gandhi Nagar, Udumalaipettai Municipality, Tamil Nadu 642154',
    '93630 59595',
    'udumalpet@myfabclean.com',
    10.583861,
    77.254672,
    10,
    'https://maps.app.goo.gl/7Qpf2upZUZCaUSsz7',
    3,
    true
  ),
  (
    'kinathukadavu',
    'Fab Clean - Kenathukadavu',
    'Krishnasamy puram, Vadaputhur, Tamil Nadu 642109',
    '93637 19595',
    'kinathukadavu@myfabclean.com',
    10.823342,
    77.017809,
    8,
    'https://maps.app.goo.gl/GAqSWZrc1LtBHUb9A',
    4,
    true
  )
on conflict (slug) do update
set
  name = excluded.name,
  address = excluded.address,
  phone = excluded.phone,
  email = excluded.email,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  coverage_radius_km = excluded.coverage_radius_km,
  map_href = excluded.map_href,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = now();
