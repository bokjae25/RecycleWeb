# 🚀 실행 & Supabase 연동 가이드

## 1. 지금 바로 실행 (오프라인 모드)

Supabase 설정 없이도 게임은 바로 동작합니다 (기록은 브라우저 localStorage에만 저장).

- `index.html`을 브라우저로 열거나
- 로컬 서버로 실행(권장): 프로젝트 폴더에서
  ```
  python -m http.server 8000
  ```
  후 브라우저에서 `http://localhost:8000` 접속

## 2. Supabase 연동 (서버 저장 + 의료진 공유)

### 2-1. DB 테이블 만들기
1. Supabase 대시보드 → 본인 프로젝트 → **SQL Editor**
2. `supabase/schema.sql` 내용을 붙여넣고 **Run**
   - `profiles`, `sessions` 테이블과 RLS 보안 정책이 생성됩니다.

### 2-2. 접속 키 넣기
1. Supabase 대시보드 → **Project Settings → API**
2. **Project URL** 과 **anon public** 키를 복사
3. `js/supabase-config.js` 파일을 열어 값 채우기:
   ```js
   window.SUPABASE_CONFIG = {
     url: "https://xxxxxxxx.supabase.co",
     anonKey: "eyJhbGciOiJIUzI1Ni....",
   };
   ```
> ⚠️ `anon` 키만 사용하세요. `service_role` 키는 절대 프론트엔드에 넣지 마세요.

### 2-3. 로그인 기능
로그인/회원가입 화면과 의료진 대시보드는 다음 단계에서 추가됩니다 (README 5·6단계).
지금은 키만 넣어두면, 로그인 기능 완성 시 자동으로 서버 저장이 활성화됩니다.

## 의료진 대시보드 사용법

1. **의료진 계정 만들기**: 게임 앱(`index.html`)에서 회원가입 시 역할을 **의료진**으로 선택
2. `dashboard.html` 접속 → 의료진 계정으로 로그인
3. 상단의 **환자 연결 코드**를 환자에게 전달
4. **환자**는 게임 앱에서 로그인 후 `담당 의료진 연결` 버튼 → 코드 입력
5. 이후 환자가 플레이한 기록이 대시보드에 그래프/표로 표시됨

## 👑 관리자 페이지 사용법

전 계정(환자·의료진·관리자)을 한 곳에서 관리합니다: 역할 변경, 담당 의료진 배정, 검색/필터, 플레이 수 확인.

### 최초 1회 설정
1. Supabase → SQL Editor 에 `supabase/admin-migration.sql` 붙여넣고 **Run**
   - `admin` 역할 허용, 프로필에 이메일 저장, 관리자 RLS 정책이 추가됩니다.
2. 관리자로 쓸 이메일로 **게임 앱에서 먼저 회원가입**
3. SQL Editor에서 아래 실행(이메일을 본인 것으로):
   ```sql
   update public.profiles set role = 'admin' where email = '본인이메일';
   ```
4. `admin.html` 접속 → 그 계정으로 로그인

이후에는 관리자 페이지에서 다른 계정의 역할도 바꿀 수 있습니다.
의료진 계정으로 게임 앱에 로그인하면 상단에 **📊 대시보드** 버튼이,
관리자면 **⚙️ 관리자** 버튼이 함께 표시됩니다.

> 계정 자체(로그인 수단)를 완전히 삭제하려면 Supabase → Authentication → Users 에서 처리하세요.
> (보안상 service_role 권한이 필요해 프론트에서는 제공하지 않습니다.)

## 🌐 배포 (GitHub Pages) — 항상 접속 가능한 주소 만들기

이 앱은 빌드가 필요 없는 정적 사이트라 GitHub Pages에 바로 올릴 수 있습니다.

### 1. 코드 푸시
```
git push
```

### 2. GitHub Pages 켜기
1. 브라우저에서 저장소 접속: https://github.com/bokjae25/RecycleWeb
2. 상단 **Settings** → 왼쪽 메뉴 **Pages**
3. **Build and deployment → Source** 를 **Deploy from a branch** 로
4. **Branch**: `main` / 폴더: `/ (root)` 선택 → **Save**
5. 1~2분 뒤 페이지 상단에 접속 주소가 표시됩니다:
   - 게임: `https://bokjae25.github.io/RecycleWeb/`
   - 대시보드: `https://bokjae25.github.io/RecycleWeb/dashboard.html`

### 3. Supabase에 배포 주소 등록 (권장)
Supabase 대시보드 → **Authentication → URL Configuration**
- **Site URL** 에 `https://bokjae25.github.io/RecycleWeb/` 추가

> ⚠️ 저장소가 **Public** 이면 코드가 공개됩니다. `supabase-config.js`의 키는
> 공개용(publishable/anon)이라 노출돼도 안전하며, 실제 데이터는 RLS로 보호됩니다.
> service_role 키는 절대 코드에 넣지 마세요.

## 진행 상황
- [x] 1단계: 메인 메뉴 + 공통 UI
- [x] 2단계: 풍선 터뜨리기 게임 + 난이도 + 결과 화면
- [x] 로컬 기록 저장 + 기록 보기
- [x] Supabase 연동 + 로그인/회원가입 + 서버 저장
- [x] 의료진 대시보드 (담당 환자 목록 + 진행 그래프)
- [ ] 다음: 게임 추가(궤적/순서기억/분리수거), 기간 필터, 접근성 마무리, 배포
