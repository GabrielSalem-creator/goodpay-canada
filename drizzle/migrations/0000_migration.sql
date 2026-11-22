create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('payer','recipient')),
  alias text not null,
  city text not null default 'Montréal',
  province text not null default 'QC',
  verified boolean not null default false,
  verification jsonb not null default '{}'::jsonb,
  monthly_income numeric not null default 0,
  household_size int not null default 1,
  preferences jsonb not null default '{}'::jsonb,
  points int not null default 0,
  card_last4 text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.bills (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in ('electricity','water','heating','internet','phone','housing','groceries')),
  provider text not null,
  payee_account text not null,
  payee_institution text not null default '',
  payment_method text not null default 'bill_payment',
  amount numeric not null check (amount > 0),
  funded numeric not null default 0,
  chunk_size numeric not null default 20,
  due_date date not null,
  note text not null default '',
  status text not null default 'open' check (status in ('open','funded','paid')),
  ai_check jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.bills(id) on delete cascade,
  payer_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric not null check (amount > 0),
  status text not null default 'held' check (status in ('held','released','rejected')),
  ai_review jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create table public.saves (
  payer_id uuid not null references public.profiles(id) on delete cascade,
  bill_id uuid not null references public.bills(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (payer_id, bill_id)
);
grant select, insert, update, delete on public.profiles, public.bills, public.payments, public.saves to anon, authenticated;
grant all on public.profiles, public.bills, public.payments, public.saves to service_role;
alter table public.profiles enable row level security;
alter table public.bills enable row level security;
alter table public.payments enable row level security;
alter table public.saves enable row level security;
-- DEMO ONLY: open access so the prototype works without accounts.
create policy "demo all" on public.profiles for all to anon, authenticated using (true) with check (true);
create policy "demo all" on public.bills for all to anon, authenticated using (true) with check (true);
create policy "demo all" on public.payments for all to anon, authenticated using (true) with check (true);
create policy "demo all" on public.saves for all to anon, authenticated using (true) with check (true);

-- Funds go to the vault; bill funded total counts held + released.
create or replace function public.contribute(_bill uuid, _payer uuid, _amount numeric)
returns uuid language plpgsql security definer set search_path = public as $$
declare b public.bills; pid uuid; remaining numeric;
begin
  select * into b from public.bills where id = _bill for update;
  if b.status <> 'open' then raise exception 'Bill is already covered'; end if;
  if not exists (select 1 from public.profiles where id = _payer and role='payer' and card_last4 is not null) then
    raise exception 'Add a card first'; end if;
  remaining := b.amount - b.funded;
  if _amount > remaining then _amount := remaining; end if;
  insert into public.payments(bill_id, payer_id, amount) values (_bill, _payer, _amount) returning id into pid;
  update public.bills set funded = funded + _amount,
    status = case when funded + _amount >= amount then 'funded' else 'open' end where id = _bill;
  update public.profiles set points = points + ceil(_amount)::int where id = _payer;
  return pid;
end $$;

create or replace function public.decide_payment(_payment uuid, _approve boolean, _review jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare p public.payments;
begin
  select * into p from public.payments where id = _payment for update;
  if p.status <> 'held' then return; end if;
  update public.payments set status = case when _approve then 'released' else 'rejected' end,
    ai_review = coalesce(_review, ai_review), decided_at = now() where id = _payment;
  if not _approve then
    update public.bills set funded = greatest(funded - p.amount, 0), status = 'open' where id = p.bill_id;
    update public.profiles set points = greatest(points - ceil(p.amount)::int, 0) where id = p.payer_id;
  else
    update public.bills set status = 'paid' where id = p.bill_id and funded >= amount
      and not exists (select 1 from public.payments where bill_id = p.bill_id and status = 'held');
  end if;
end $$;
grant execute on function public.contribute(uuid, uuid, numeric), public.decide_payment(uuid, boolean, jsonb) to anon, authenticated;

insert into public.profiles (id, role, alias, city, province, verified, verification, monthly_income, household_size, preferences, points, card_last4, is_demo) values
('00000000-0000-0000-0000-000000000001','recipient','Maple 4821','Montréal','QC',true,'{"id":"Driver licence · QC","liveness":"passed","income":"T4 + bank statement","sin":"verified","risk":"low"}',1850,2,'{}',0,null,true),
('00000000-0000-0000-0000-000000000002','payer','Loon 0917','Montréal','QC',true,'{"id":"Passport · CA","liveness":"passed","risk":"low"}',0,1,'{"cities":["Montréal","Laval"],"categories":["electricity","heating","water"],"budget":100}',340,'4242',true),
('00000000-0000-0000-0000-000000000003','recipient','Birch 2290','Laval','QC',true,'{"id":"Health card · QC","liveness":"passed","risk":"low"}',1400,3,'{}',0,null,false),
('00000000-0000-0000-0000-000000000004','recipient','Cedar 7713','Toronto','ON',true,'{"id":"Driver licence · ON","liveness":"passed","risk":"low"}',2100,4,'{}',0,null,false),
('00000000-0000-0000-0000-000000000005','recipient','Aspen 3304','Montréal','QC',true,'{"id":"Passport · CA","liveness":"passed","risk":"low"}',1100,1,'{}',0,null,false),
('00000000-0000-0000-0000-000000000006','recipient','Spruce 5102','Vancouver','BC',true,'{"id":"BC Services Card","liveness":"passed","risk":"low"}',1950,2,'{}',0,null,false),
('00000000-0000-0000-0000-000000000007','payer','Heron 6620','Toronto','ON',true,'{}',0,1,'{}',880,'1881',false),
('00000000-0000-0000-0000-000000000008','payer','Otter 1145','Calgary','AB',true,'{}',0,1,'{}',515,'0005',false);

insert into public.bills (recipient_id, category, provider, payee_account, payee_institution, payment_method, amount, funded, chunk_size, due_date, note, status, created_at) values
('00000000-0000-0000-0000-000000000001','electricity','Hydro-Québec','299 104 551 2','Hydro-Québec biller','bill_payment',184.32,40,20,current_date+9,'Winter heating month. Working part-time while studying.','open',now()-interval '6 days'),
('00000000-0000-0000-0000-000000000001','internet','Vidéotron','4410 8820 113','Vidéotron biller','bill_payment',75.00,75,25,current_date+3,'Needed for job applications.','funded',now()-interval '20 days'),
('00000000-0000-0000-0000-000000000003','heating','Énergir','7781 2201 004','Énergir biller','bill_payment',312.80,20,20,current_date+5,'Gas heating, 3 kids at home.','open',now()-interval '11 days'),
('00000000-0000-0000-0000-000000000005','housing','Landlord (Interac)','landlord.plateau@mail.ca','Interac e-Transfer','interac',650.00,120,50,current_date+12,'Partial rent, lost hours this month.','open',now()-interval '3 days'),
('00000000-0000-0000-0000-000000000004','electricity','Toronto Hydro','5520 3312 98','Toronto Hydro biller','bill_payment',142.10,0,20,current_date+7,'','open',now()-interval '14 days'),
('00000000-0000-0000-0000-000000000006','water','City of Vancouver Utilities','UB-88213-04','City of Vancouver','bill_payment',96.40,0,20,current_date+15,'Quarterly water bill.','open',now()-interval '2 days'),
('00000000-0000-0000-0000-000000000005','phone','Fizz','514-555-0182','Fizz biller','bill_payment',35.00,0,35,current_date+4,'Phone for work shifts.','open',now()-interval '8 days'),
('00000000-0000-0000-0000-000000000003','groceries','IGA (gift card)','IGA-LAVAL-221','Merchant voucher','voucher',120.00,0,20,current_date+6,'Food for the week.','open',now()-interval '1 day');

insert into public.payments (bill_id, payer_id, amount, status, created_at)
select id, '00000000-0000-0000-0000-000000000007', funded, 'held', now()-interval '1 day' from public.bills where funded > 0 and provider <> 'Vidéotron';
insert into public.payments (bill_id, payer_id, amount, status, decided_at, ai_review)
select id, '00000000-0000-0000-0000-000000000008', 75, 'released', now(), '{"decision":"approve","reason":"Matched biller, verified recipient."}' from public.bills where provider = 'Vidéotron';