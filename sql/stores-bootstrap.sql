create table if not exists website_stores (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  address text not null,
  phone text not null,
  email text,
  latitude real not null,
  longitude real not null,
  coverage_radius_km real not null default 3,
  map_href text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

-- Hide legacy short-name / UUID-slug duplicates (Pollachi, Kinathukadavu, Udumalpet, MCET, etc.)
update website_stores
set
  is_active = false,
  updated_at = now()
where is_active = true
  and (
    slug not in ('pollachi', 'suleeshwaranpatti', 'udumalpet', 'kinathukadavu')
    or name !~* '^Fab[[:space:]]*Clean[[:space:]]*-'
  );

alter table pickups
  alter column branch type text using branch::text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'pickups_branch_stores_slug_fk'
  ) then
    alter table pickups
      add constraint pickups_branch_stores_slug_fk
      foreign key (branch) references website_stores(slug)
      on update cascade
      on delete restrict;
  end if;
end $$;

create index if not exists website_stores_active_sort_idx on website_stores (is_active, sort_order, name);
create index if not exists pickups_branch_idx on pickups (branch);
