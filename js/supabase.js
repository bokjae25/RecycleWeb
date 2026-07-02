/* ============================================================
   Supabase 클라이언트 초기화
   설정이 비어있으면 online=false 로 두고 앱은 오프라인 모드 동작.
   ============================================================ */

window.Backend = (function () {
  const cfg = window.SUPABASE_CONFIG || {};
  let client = null;
  let online = false;

  if (cfg.url && cfg.anonKey && window.supabase) {
    try {
      client = window.supabase.createClient(cfg.url, cfg.anonKey);
      online = true;
      console.log("[Backend] Supabase 연결됨");
    } catch (e) {
      console.warn("[Backend] Supabase 초기화 실패, 오프라인 모드로 전환", e);
    }
  } else {
    console.log("[Backend] Supabase 미설정 → 오프라인 모드 (localStorage)");
  }

  async function getUser() {
    if (!online) return null;
    const { data } = await client.auth.getUser();
    return data ? data.user : null;
  }

  /* 로그인한 사용자의 프로필(역할 등) 조회 */
  async function getProfile() {
    if (!online) return null;
    const user = await getUser();
    if (!user) return null;
    const { data, error } = await client
      .from("profiles").select("*").eq("id", user.id).single();
    return error ? null : data;
  }

  async function signIn(email, password) {
    if (!online) throw new Error("서버 미연결");
    return client.auth.signInWithPassword({ email, password });
  }

  async function signUp(email, password, meta) {
    if (!online) throw new Error("서버 미연결");
    return client.auth.signUp({ email, password, options: { data: meta } });
  }

  async function signOut() {
    if (!online) return;
    return client.auth.signOut();
  }

  /* 게임 세션 기록을 서버에 저장 */
  async function saveSession(session) {
    if (!online) throw new Error("서버 미연결");
    const user = await getUser();
    if (!user) throw new Error("로그인 필요");
    return client.from("sessions").insert({
      patient_id: user.id,
      game: session.game,
      difficulty: session.difficulty,
      score: session.score,
      accuracy: session.accuracy,
      avg_reaction_ms: session.avgReactionMs,
      duration_sec: session.durationSec,
      played_at: session.playedAt,
    });
  }

  return {
    get online() { return online; },
    get client() { return client; },
    getUser, getProfile, signIn, signUp, signOut, saveSession,
  };
})();
