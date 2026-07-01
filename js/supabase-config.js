/* ============================================================
   Supabase 접속 설정
   ------------------------------------------------------------
   본인 Supabase 프로젝트의 값으로 아래 두 줄을 채워주세요.
   Supabase 대시보드 → Project Settings → API 에서 확인:
     - Project URL
     - anon public key (공개용 키, 프론트엔드에 노출 OK)

   ⚠️ service_role 키는 절대 여기에 넣지 마세요 (비공개 키).
   값을 비워두면 앱은 자동으로 "오프라인 모드"(localStorage만)로 동작합니다.
   ============================================================ */

window.SUPABASE_CONFIG = {
  url: "",      // 예: "https://xxxxxxxx.supabase.co"
  anonKey: "",  // 예: "eyJhbGciOiJIUzI1Ni...."
};
