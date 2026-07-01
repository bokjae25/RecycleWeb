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

## 진행 상황
- [x] 1단계: 메인 메뉴 + 공통 UI
- [x] 2단계: 풍선 터뜨리기 게임 + 난이도 + 결과 화면
- [x] 로컬 기록 저장 + 기록 보기
- [x] Supabase 연동 뼈대 + DB 스키마
- [ ] 다음: 로그인/회원가입 화면, 서버 동기화 활성화, 의료진 대시보드
