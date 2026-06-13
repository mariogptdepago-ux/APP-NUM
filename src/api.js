window.PVI_API = (() => {
  const cfg = window.PVI_CONFIG;
  const hasBackend = () => Boolean(cfg.APPS_SCRIPT_URL && cfg.APPS_SCRIPT_URL.startsWith('http'));
  async function request(action, payload = {}) {
    if (!hasBackend()) return { ok: false, offline: true, message: 'Backend no configurado.' };
    try {
      const res = await fetch(cfg.APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, ...payload })
      });
      return await res.json();
    } catch (error) {
      return { ok: false, message: error.message };
    }
  }
  function getLocal(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  }
  function setLocal(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
  return {
    request,
    async login(username, password) {
      if (hasBackend()) return await request('login', { username, password });
      const users = [
        { userId:'stu_demo', username:'demo', password:'1234', fullName:'Estudiante Demo', grade:'9B', role:'student' },
        { userId:'admin_demo', username:'admin', password:'admin123', fullName:'Superusuario Demo', grade:'', role:'superuser' }
      ];
      const user = users.find(u => u.username === username && u.password === password);
      if (!user) return { ok:false, message:'Usuario o contraseña incorrectos.' };
      return { ok:true, user: { ...user, password: undefined }, token: `local-${Date.now()}` };
    },
    async saveAttempt(attempt) {
      if (hasBackend()) return await request('saveAttempt', { attempt });
      const rows = getLocal('pvi_attempts', []); rows.push(attempt); setLocal('pvi_attempts', rows); return { ok:true };
    },
    async saveProgress(progress) {
      if (hasBackend()) return await request('saveProgress', { progress });
      setLocal(`pvi_progress_${progress.userId}_${progress.descriptorId}`, progress); return { ok:true };
    },
    async saveEvent(event) {
      if (hasBackend()) return await request('saveEvent', { event });
      const rows = getLocal('pvi_events', []); rows.push(event); setLocal('pvi_events', rows); return { ok:true };
    },
    async burnQuestion(payload) {
      if (hasBackend()) return await request('burnQuestion', payload);
      const rows = getLocal('pvi_burned', []); rows.push(payload); setLocal('pvi_burned', rows); return { ok:true };
    },
    async issueCertificate(payload) {
      if (hasBackend()) return await request('issueCertificate', payload);
      return window.PVI_CERT.localDemoCertificate(payload);
    },
    async verifyCertificate(certificateId) {
      if (hasBackend()) return await request('verifyCertificate', { certificateId });
      const certs = getLocal('pvi_certificates', []);
      const certificate = certs.find(c => c.certificateId === certificateId);
      if (!certificate) return { ok:false, message:'Código no encontrado en modo local.' };
      return { ok:true, certificate };
    },
    async listCertificates() {
      if (hasBackend()) return await request('listCertificates', {});
      return { ok:true, certificates: getLocal('pvi_certificates', []) };
    }
  };
})();
