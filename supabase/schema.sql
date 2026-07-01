-- ============================================================
-- RecycleWeb 재활 게임 DB 스키마
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 실행하세요.
-- ============================================================

-- 1) 프로필: auth.users 와 1:1, 역할(환자/의료진) 구분
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text,
  role          text not null default 'patient' check (role in ('patient', 'clinician')),
  clinician_id  uuid references public.profiles(id),  -- 환자의 담당 의료진
  created_at    timestamptz not null default now()
);

-- 2) 게임 세션 기록
create table if not exists public.sessions (
  id              bigint generated always as identity primary key,
  patient_id      uuid not null references public.profiles(id) on delete cascade,
  game            text not null,
  difficulty      text not null,
  score           integer not null default 0,
  accuracy        integer,             -- 0~100 (%)
  avg_reaction_ms integer,             -- 평균 반응 시간(ms)
  duration_sec    integer,
  played_at       timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

create index if not exists idx_sessions_patient on public.sessions(patient_id, played_at desc);

-- ============================================================
-- 3) 회원가입 시 프로필 자동 생성 트리거
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'patient')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 4) 행 수준 보안 (RLS)
--    - 환자: 본인 프로필/기록만 접근
--    - 의료진: 담당 환자의 프로필/기록 조회
-- ============================================================
alter table public.profiles enable row level security;
alter table public.sessions enable row level security;

-- 본인 프로필 조회/수정
create policy "본인 프로필 조회" on public.profiles
  for select using (auth.uid() = id);
create policy "본인 프로필 수정" on public.profiles
  for update using (auth.uid() = id);

-- 의료진은 담당 환자 프로필 조회
create policy "의료진 담당환자 프로필 조회" on public.profiles
  for select using (clinician_id = auth.uid());

-- 환자 본인 세션 삽입/조회
create policy "본인 세션 삽입" on public.sessions
  for insert with check (auth.uid() = patient_id);
create policy "본인 세션 조회" on public.sessions
  for select using (auth.uid() = patient_id);

-- 의료진은 담당 환자 세션 조회
create policy "의료진 담당환자 세션 조회" on public.sessions
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = sessions.patient_id and p.clinician_id = auth.uid()
    )
  );
