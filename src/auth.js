window.PVI_AUTH = (() => {
  const KEY = 'pvi_session';
  function getSession() {
    try { return JSON.parse(localStorage.getItem(KEY) || sessionStorage.getItem(KEY)); } catch { return null; }
  }
  function setSession(data, keep) {
    const store = keep ? localStorage : sessionStorage;
    store.setItem(KEY, JSON.stringify(data));
  }
  function logout() {
    localStorage.removeItem(KEY); sessionStorage.removeItem(KEY); location.reload();
  }
  async function login(username, password, keepSession) {
    const res = await PVI_API.login(username, password);
    if (res.ok) setSession({ user: res.user, token: res.token, createdAt: Date.now() }, keepSession);
    return res;
  }
  return { getSession, setSession, logout, login };
})();
