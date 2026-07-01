/* ============================================================
   기록 저장소
   - 항상 localStorage에 먼저 저장 (오프라인 대비)
   - 서버 연결 + 로그인 상태면 Supabase에도 업로드
   - 업로드 실패한 기록은 "pending"으로 두었다가 재시도
   ============================================================ */

window.Store = (function () {
  const KEY = "recycleweb_sessions";
  const PENDING = "recycleweb_pending";

  function load(key) {
    try { return JSON.parse(localStorage.getItem(key)) || []; }
    catch { return []; }
  }
  function save(key, arr) {
    localStorage.setItem(key, JSON.stringify(arr));
  }

  function getLocalSessions() {
    return load(KEY).sort((a, b) => new Date(b.playedAt) - new Date(a.playedAt));
  }

  /* 세션 하나를 저장하고, 가능하면 서버 동기화 */
  async function record(session) {
    const local = load(KEY);
    local.push(session);
    save(KEY, local);

    const result = { savedLocal: true, savedServer: false, reason: "" };

    if (window.Backend && Backend.online) {
      try {
        const user = await Backend.getUser();
        if (!user) {
          result.reason = "로그인하면 의료진과 기록이 공유됩니다.";
          queuePending(session);
        } else {
          const { error } = await Backend.saveSession(session);
          if (error) throw error;
          result.savedServer = true;
        }
      } catch (e) {
        result.reason = "서버 저장 실패 — 나중에 자동 재시도합니다.";
        queuePending(session);
        console.warn("[Store] 서버 저장 실패", e);
      }
    } else {
      result.reason = "오프라인 모드 (기기에만 저장)";
    }
    return result;
  }

  function queuePending(session) {
    const p = load(PENDING);
    p.push(session);
    save(PENDING, p);
  }

  /* 로그인 후/재접속 시 밀린 기록 업로드 */
  async function syncPending() {
    if (!(window.Backend && Backend.online)) return { synced: 0 };
    const user = await Backend.getUser();
    if (!user) return { synced: 0 };

    const p = load(PENDING);
    if (!p.length) return { synced: 0 };

    const remaining = [];
    let synced = 0;
    for (const s of p) {
      try {
        const { error } = await Backend.saveSession(s);
        if (error) throw error;
        synced++;
      } catch {
        remaining.push(s);
      }
    }
    save(PENDING, remaining);
    return { synced };
  }

  return { record, getLocalSessions, syncPending };
})();
