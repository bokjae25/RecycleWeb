/* ============================================================
   로그인 / 회원가입 화면 로직
   - 로그인 성공/회원가입 후 onChange 콜백으로 메인에 알림
   - 환자/의료진 역할은 회원가입 시 선택 (프로필 트리거가 저장)
   ============================================================ */

window.Auth = (function () {
  let mode = "login"; // "login" | "signup"
  let onChange = null;

  const $ = (id) => document.getElementById(id);

  function init(callbacks) {
    onChange = callbacks.onChange;

    $("authToggle").addEventListener("click", toggleMode);
    $("authSubmit").addEventListener("click", submit);
    $("authSkip").addEventListener("click", () => callbacks.onSkip());
    // 엔터로 제출
    ["authEmail", "authPassword", "authName"].forEach((id) =>
      $(id).addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); })
    );
  }

  function open(startMode) {
    setMode(startMode || "login");
    setError("");
    callbacksShowScreen();
  }

  let showScreenFn = null;
  function bindShowScreen(fn) { showScreenFn = fn; }
  function callbacksShowScreen() { if (showScreenFn) showScreenFn("authScreen"); }

  function toggleMode() { setMode(mode === "login" ? "signup" : "login"); }

  function setMode(m) {
    mode = m;
    const signup = m === "signup";
    $("signupFields").style.display = signup ? "block" : "none";
    $("authTitle").textContent = signup ? "회원가입" : "로그인";
    $("authSubmit").textContent = signup ? "가입하기" : "로그인";
    $("authToggle").textContent = signup
      ? "이미 계정이 있으신가요? 로그인"
      : "계정이 없으신가요? 회원가입";
    $("authPassword").setAttribute("autocomplete", signup ? "new-password" : "current-password");
    setError("");
  }

  function setError(msg) { $("authError").textContent = msg; }

  async function submit() {
    const email = $("authEmail").value.trim();
    const password = $("authPassword").value;

    if (!email || !password) return setError("이메일과 비밀번호를 입력해주세요.");
    if (password.length < 6) return setError("비밀번호는 6자 이상이어야 합니다.");
    if (!(window.Backend && Backend.online)) return setError("서버에 연결되어 있지 않습니다.");

    $("authSubmit").disabled = true;
    setError("");

    try {
      if (mode === "signup") {
        const name = $("authName").value.trim();
        const role = $("authRole").value;
        const { data, error } = await Backend.signUp(email, password, {
          full_name: name, role,
        });
        if (error) throw error;
        // 이메일 확인이 꺼져 있으면 session이 바로 생김
        if (data.session) {
          finishSuccess();
        } else {
          setMode("login");
          setError("가입 완료! 이메일 인증이 필요하면 메일함을 확인한 뒤 로그인하세요.");
        }
      } else {
        const { error } = await Backend.signIn(email, password);
        if (error) throw error;
        finishSuccess();
      }
    } catch (e) {
      setError(translateError(e));
    } finally {
      $("authSubmit").disabled = false;
    }
  }

  function finishSuccess() {
    $("authPassword").value = "";
    if (onChange) onChange();
  }

  function translateError(e) {
    const m = (e && e.message) || "";
    if (/Invalid login/i.test(m)) return "이메일 또는 비밀번호가 올바르지 않습니다.";
    if (/already registered/i.test(m)) return "이미 가입된 이메일입니다.";
    if (/Email not confirmed/i.test(m)) return "이메일 인증이 필요합니다. 메일함을 확인해주세요.";
    return m || "요청 처리 중 오류가 발생했습니다.";
  }

  return { init, open, bindShowScreen };
})();
