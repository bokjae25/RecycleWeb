-- ============================================================
-- 관리자(admin) 기능 추가 마이그레이션
-- Supabase → SQL Editor 에 붙여넣고 Run (schema.sql 실행 후 1회)
-- ============================================================

-- 1) role 에 'admin' 허용
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('patient', 'clinician', 'admin'));

-- 2) 이메일을 프로필에도 저장 (관리자 목록에서 이메일 표시용)
alter table public.profiles add column if not exists email text;

-- 기존 사용자 이메일 백필
update public.profiles p
  set email = u.email
  from auth.users u
  where u.id = p.id and p.email is null;

-- 3) 회원가입 트리거가 이메일도 저장하도록 갱신
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'patient'),
    new.email
  );
  return new;
end;
$$;

-- 4) 관리자 판별 함수 (SECURITY DEFINER 라 RLS 재귀 없이 동작)
create or replace function public.is_admin()
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- 5) 관리자 RLS 정책: 모든 프로필/세션 조회 및 프로필 수정
drop policy if exists "관리자 프로필 조회" on public.profiles;
create policy "관리자 프로필 조회" on public.profiles
  for select using (public.is_admin());

drop policy if exists "관리자 프로필 수정" on public.profiles;
create policy "관리자 프로필 수정" on public.profiles
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "관리자 세션 조회" on public.sessions;
create policy "관리자 세션 조회" on public.sessions
  for select using (public.is_admin());

-- ============================================================
-- 6) 첫 관리자 지정 (아래 이메일을 본인 관리자 계정으로 바꿔 실행)
--    먼저 게임 앱에서 해당 이메일로 회원가입한 뒤 실행하세요.
-- ============================================================
-- update public.profiles set role = 'admin'
--   where email = 'admin@example.com';
