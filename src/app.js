window.PVI_APP = (() => {
  const root = document.getElementById('app');
  const state = {
    session: null,
    descriptors: [],
    skills: [],
    commonErrors: [],
    questions: [],
    descriptor: null,
    currentSkill: null,
    skillStates: {},
    activeQuestion: null,
    activeStartedAt: null,
    selected: null,
    checked: false,
    sessionAttempts: [],
    reviewQueue: [],
    burnedQuestions: new Set(),
    warning: ''
  };

  async function loadJSON(path) {
    const res = await fetch(path);
    return await res.json();
  }

  async function init() {
    state.session = PVI_AUTH.getSession();
    if (!state.session) return renderLogin();
    await loadData();
    initSkillStates();
    renderDashboard();
  }

  async function loadData() {
    const [descriptors, skills, commonErrors, questions] = await Promise.all([
      loadJSON('data/descriptors.json'),
      loadJSON('data/skills.json'),
      loadJSON('data/common_errors.json'),
      loadJSON('data/questions_limits.json')
    ]);
    state.descriptors = descriptors;
    state.skills = skills;
    state.commonErrors = commonErrors;
    state.questions = questions;
    state.descriptor = descriptors[0];
  }

  function initSkillStates() {
    state.skills.forEach(skill => {
      state.skillStates[skill.id] = PVI_SPACING.initialSkillState(skill);
    });
  }

  function renderLogin() {
    root.innerHTML = `
      <section class="card login-box">
        <div class="brand"><div class="logo">PVI</div><div><h1>Pablo VI Math App</h1><p>Entrenamiento adaptativo gratuito</p></div></div>
        <div class="form-stack">
          <input id="username" placeholder="Usuario" autocomplete="username" />
          <input id="password" type="password" placeholder="Contraseña" autocomplete="current-password" />
          <label><input id="keepSession" type="checkbox" style="width:auto" /> Mantener sesión abierta</label>
          <button class="btn primary" id="loginBtn">Iniciar sesión</button>
          <p id="loginMsg" class="bad"></p>
          <small>Demo: usuario <strong>demo</strong>, contraseña <strong>1234</strong>. Superusuario: <strong>admin</strong> / <strong>admin123</strong>.</small>
        </div>
      </section>
    `;
    document.getElementById('loginBtn').addEventListener('click', async () => {
      const username = document.getElementById('username').value.trim();
      const password = document.getElementById('password').value;
      const keep = document.getElementById('keepSession').checked;
      const res = await PVI_AUTH.login(username, password, keep);
      if (!res.ok) { document.getElementById('loginMsg').textContent = res.message || 'No se pudo iniciar sesión.'; return; }
      state.session = PVI_AUTH.getSession();
      await loadData(); initSkillStates(); renderDashboard();
    });
  }

  function renderTopbar() {
    const u = state.session.user;
    return `
      <header class="topbar">
        <div class="brand"><div class="logo">PVI</div><div><h1>${PVI_CONFIG.APP_NAME}</h1><p>${state.descriptor.learning}</p></div></div>
        <div>
          <span class="badge">${u.fullName} ${u.grade ? '· ' + u.grade : ''}</span>
          <button class="btn secondary" onclick="PVI_AUTH.logout()">Salir</button>
        </div>
      </header>
    `;
  }

  function renderDashboard() {
    PVI_SESSION_GUARD.stop();
    const levels = state.skills.map((skill, idx) => {
      const ss = state.skillStates[skill.id];
      const pct = Math.round(ss.mastery * 100);
      const rec = Math.round(PVI_SPACING.recall(ss) * 100);
      const mastered = PVI_SPACING.isMastered(ss);
      const locked = idx > 0 && !PVI_SPACING.isMastered(state.skillStates[state.skills[idx - 1].id]) && ss.attempts === 0;
      return `
        <article class="level-card ${locked ? 'locked' : ''}">
          <span class="badge">Nivel ${idx + 1}</span>
          <h2>${skill.name}</h2>
          <p>${skill.purpose}</p>
          <div class="progress"><span style="width:${pct}%"></span></div>
          <small>Dominio: ${pct}% · Recuperabilidad: ${rec}% · Intentos: ${ss.attempts}/20</small>
          <button class="btn ${mastered ? 'secondary' : 'primary'}" ${locked ? 'disabled' : ''} onclick="PVI_APP.startSkill('${skill.id}')">${mastered ? 'Repasar' : 'Entrenar'}</button>
        </article>`;
    }).join('');
    const global = globalStats();
    root.innerHTML = `
      ${renderTopbar()}
      <section class="card">
        <span class="badge">Eje temático: ${state.descriptor.axis}</span>
        <h2>${state.descriptor.name}</h2>
        <p><strong>Descriptor:</strong> ${state.descriptor.descriptors[0]}</p>
        <div class="grid three">
          <div class="stat">Dominio global<span>${Math.round(global.mastery*100)}%</span></div>
          <div class="stat">Recuperabilidad<span>${Math.round(global.recall*100)}%</span></div>
          <div class="stat">Microhabilidades dominadas<span>${global.mastered}/${state.skills.length}</span></div>
        </div>
      </section>
      <section class="grid levels" style="margin-top:18px">${levels}</section>
      <section class="card" style="margin-top:18px">
        <h2>Reportes y certificación</h2>
        <div class="grid three">
          <button class="btn secondary" onclick="PVI_APP.downloadReportHTML()">Descargar informe HTML</button>
          <button class="btn secondary" onclick="PVI_APP.downloadReportCSV()">Descargar CSV</button>
          <button class="btn primary" onclick="PVI_APP.issueCertificate()">Emitir mini diploma</button>
        </div>
        <div id="certificateArea" style="margin-top:18px"></div>
      </section>
    `;
  }

  function globalStats() {
    const vals = Object.values(state.skillStates);
    return {
      mastery: vals.reduce((s,x)=>s+x.mastery,0) / vals.length,
      recall: vals.reduce((s,x)=>s+PVI_SPACING.recall(x),0) / vals.length,
      mastered: vals.filter(PVI_SPACING.isMastered).length
    };
  }

  function startSkill(skillId) {
    state.currentSkill = state.skills.find(s => s.id === skillId);
    state.reviewQueue = [];
    nextQuestion();
    PVI_SESSION_GUARD.requestFullscreen();
    PVI_SESSION_GUARD.start(handleViolation);
  }

  function getQuestionsForSkill(skillId) {
    return state.questions.filter(q => q.skillId === skillId);
  }

  function chooseQuestion() {
    if (state.reviewQueue.length) return state.reviewQueue.shift();
    const skillId = state.currentSkill.id;
    const ss = state.skillStates[skillId];
    const families = [...new Set(getQuestionsForSkill(skillId).map(q => q.familyId))];
    const neededFamily = families.find(f => !ss.history.some(h => h.familyId === f && h.correct));
    const familyId = neededFamily || families[Math.floor(Math.random() * families.length)];
    return chooseVariant(familyId, 0);
  }

  function chooseVariant(familyId, minVariant = 0) {
    const options = state.questions.filter(q => q.familyId === familyId && !state.burnedQuestions.has(q.id));
    return options.find(q => q.variantIndex >= minVariant) || options[0] || state.questions.find(q => q.familyId === familyId);
  }

  function nextQuestion() {
    state.selected = null; state.checked = false;
    state.activeQuestion = chooseQuestion();
    state.activeStartedAt = Date.now();
    renderQuestion();
  }

  function renderQuestion() {
    const q = state.activeQuestion;
    const ss = state.skillStates[state.currentSkill.id];
    const errors = state.commonErrors.filter(e => e.skillId === state.currentSkill.id).slice(0, 4).map(e => `<li><strong>${e.name}:</strong> ${e.shortHint}</li>`).join('');
    const optionButtons = q.options.map((op, i) => `<button class="option" data-i="${i}" onclick="PVI_APP.selectOption(${i})">${op}</button>`).join('');
    const table = q.table ? `<div class="table-wrap"><table><thead><tr>${q.table.headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${q.table.rows.map(row=>`<tr>${row.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '';
    root.innerHTML = `
      ${renderTopbar()}
      <div class="question-layout">
        <section class="card">
          ${state.warning ? `<div class="session-warning">${state.warning}</div>` : ''}
          <span class="badge">${state.currentSkill.name} · Pregunta ${ss.attempts + 1}/20</span>
          <h2 class="question-title">${q.prompt}</h2>
          ${table}
          <div class="options">${optionButtons}</div>
          <div id="feedback" class="feedback"></div>
          <div style="margin-top:16px"><button id="checkBtn" class="btn primary" disabled onclick="PVI_APP.checkAnswer()">Comprobar</button></div>
        </section>
        <aside class="side-panel">
          <div class="stat">Dominio<span>${Math.round(ss.mastery*100)}%</span></div>
          <div class="stat">Recuperabilidad<span>${Math.round(PVI_SPACING.recall(ss)*100)}%</span></div>
          <div class="stat">Racha<span>${ss.streak}</span></div>
          <div class="card"><h2>Errores frecuentes</h2><ul>${errors}</ul></div>
        </aside>
      </div>
    `;
  }

  function selectOption(i) {
    if (state.checked) return;
    state.selected = i;
    document.querySelectorAll('.option').forEach(btn => btn.classList.toggle('selected', Number(btn.dataset.i) === i));
    document.getElementById('checkBtn').disabled = false;
  }

  async function checkAnswer() {
    const q = state.activeQuestion;
    const ok = state.selected === q.answer;
    document.querySelectorAll('.option').forEach(btn => {
      const i = Number(btn.dataset.i);
      btn.disabled = true;
      if (i === q.answer) btn.classList.add('correct');
      if (i === state.selected && i !== q.answer) btn.classList.add('wrong');
    });
    await finalizeQuestion(ok, false, 'answered');
  }

  async function finalizeQuestion(ok, lost, reason) {
    if (state.checked) return;
    state.checked = true;
    const q = state.activeQuestion;
    const ss = state.skillStates[state.currentSkill.id];
    const responseMs = Date.now() - state.activeStartedAt;
    const { recallBefore } = PVI_SPACING.updateSkill(ss, q, ok && !lost, responseMs);
    const attempt = {
      attemptId: `${state.session.user.userId}_${Date.now()}`,
      userId: state.session.user.userId,
      descriptorId: state.descriptor.id,
      skillId: q.skillId,
      questionId: q.id,
      familyId: q.familyId,
      variantIndex: q.variantIndex,
      correct: ok && !lost,
      lost,
      burned: lost,
      reason,
      responseMs,
      selected: state.selected === null ? '' : q.options[state.selected],
      expected: q.options[q.answer],
      masteryAfter: ss.mastery,
      recallBefore,
      timestamp: new Date().toISOString()
    };
    state.sessionAttempts.push(attempt);
    await PVI_API.saveAttempt(attempt);
    await PVI_API.saveProgress({ userId: state.session.user.userId, descriptorId: state.descriptor.id, skillId: q.skillId, ...ss });

    const fb = document.getElementById('feedback');
    if (!fb) return;
    if (ok && !lost) {
      fb.className = 'feedback show ok';
      fb.innerHTML = `Correcto. ${q.feedbackCorrect}`;
    } else {
      const twin = chooseVariant(q.familyId, q.variantIndex + 1);
      if (twin && twin.id !== q.id) state.reviewQueue.push(twin);
      fb.className = 'feedback show no';
      fb.innerHTML = `${lost ? 'Pregunta perdida por salida de sesión.' : 'Casi.'} <strong>Nota corta:</strong> ${q.feedbackWrong}<br>Se programó una pregunta gemela para refuerzo.`;
    }
    document.getElementById('checkBtn').textContent = PVI_SPACING.isMastered(ss) || ss.attempts >= 20 ? 'Finalizar nivel' : 'Continuar';
    document.getElementById('checkBtn').disabled = false;
    document.getElementById('checkBtn').onclick = () => {
      if (PVI_SPACING.isMastered(ss) || ss.attempts >= 20) { PVI_SESSION_GUARD.stop(); renderDashboard(); }
      else nextQuestion();
    };
  }

  async function handleViolation(type, detail) {
    if (!state.activeQuestion || state.checked) return;
    state.warning = detail;
    const q = state.activeQuestion;
    state.burnedQuestions.add(q.id);
    const replacement = chooseVariant(q.familyId, q.variantIndex + 1);
    await PVI_API.saveEvent({ eventId:`evt_${Date.now()}`, userId:state.session.user.userId, descriptorId:state.descriptor.id, questionId:q.id, eventType:type, detail, timestamp:new Date().toISOString() });
    await PVI_API.burnQuestion({ userId:state.session.user.userId, questionId:q.id, familyId:q.familyId, reason:type, replacementQuestionId: replacement?.id || '', timestamp:new Date().toISOString() });
    await finalizeQuestion(false, true, type);
  }

  function reportData() {
    const skillRows = state.skills.map(skill => {
      const ss = state.skillStates[skill.id];
      return { skillId:skill.id, skill:skill.name, correct:ss.correct, wrong:ss.wrong, attempts:ss.attempts, mastery:ss.mastery, recall:PVI_SPACING.recall(ss), halfLifeHours:ss.halfLifeHours, avgSeconds:ss.attempts ? ss.totalMs / ss.attempts / 1000 : 0 };
    });
    return { user:state.session.user, descriptor:state.descriptor, generatedAt:new Date().toLocaleString('es-CO'), skills:skillRows, attempts:state.sessionAttempts, global:globalStats() };
  }

  function downloadText(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  function downloadReportCSV() {
    const data = reportData();
    const rows = [['intento','usuario','microhabilidad','pregunta','familia','variante','correcta','perdida','tiempo_segundos','respuesta','esperada','dominio','recuperabilidad_antes','fecha']];
    data.attempts.forEach((a,i)=>rows.push([i+1,a.userId,a.skillId,a.questionId,a.familyId,a.variantIndex,a.correct?'si':'no',a.lost?'si':'no',(a.responseMs/1000).toFixed(2),a.selected,a.expected,Number(a.masteryAfter).toFixed(4),Number(a.recallBefore).toFixed(4),a.timestamp]));
    const csv = rows.map(r=>r.map(c=>`"${String(c??'').replaceAll('"','""')}"`).join(';')).join('\n');
    downloadText('reporte_microhabilidades.csv', csv, 'text/csv;charset=utf-8');
  }

  function downloadReportHTML() {
    const data = reportData();
    const skillTable = data.skills.map(s=>`<tr><td>${s.skill}</td><td>${s.attempts}</td><td>${s.correct}</td><td>${s.wrong}</td><td>${Math.round(s.mastery*100)}%</td><td>${Math.round(s.recall*100)}%</td><td>${s.avgSeconds.toFixed(1)} s</td></tr>`).join('');
    const attempts = data.attempts.map((a,i)=>`<tr><td>${i+1}</td><td>${a.questionId}</td><td>${a.skillId}</td><td>${a.correct?'Correcta':'Falló'}</td><td>${a.lost?'Sí':'No'}</td><td>${(a.responseMs/1000).toFixed(1)} s</td></tr>`).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Reporte</title><link rel="stylesheet" href="assets/styles.css"></head><body><main class="app-shell"><section class="card"><h1>Reporte de microhabilidades</h1><p>${data.user.fullName} · ${data.user.grade} · ${data.generatedAt}</p><h2>Dominio por microhabilidad</h2><table><thead><tr><th>Microhabilidad</th><th>Intentos</th><th>Aciertos</th><th>Fallas</th><th>Dominio</th><th>Recuperabilidad</th><th>Tiempo prom.</th></tr></thead><tbody>${skillTable}</tbody></table><h2>Intentos</h2><table><tbody>${attempts}</tbody></table></section></main></body></html>`;
    downloadText('reporte_microhabilidades.html', html, 'text/html;charset=utf-8');
  }

  async function issueCertificate() {
    const global = globalStats();
    const payload = {
      studentId: state.session.user.userId,
      studentName: state.session.user.fullName,
      grade: state.session.user.grade,
      axisId: state.descriptor.id,
      axisName: state.descriptor.axis,
      descriptors: state.descriptor.descriptors,
      mastery: global.mastery,
      retrievability: global.recall,
      issuedBy: state.session.user.userId
    };
    const res = await PVI_API.issueCertificate(payload);
    const area = document.getElementById('certificateArea');
    if (!res.ok) { area.innerHTML = `<p class="bad">${res.message || 'No se pudo emitir.'}</p>`; return; }
    area.innerHTML = `<div class="no-print"><button class="btn secondary" onclick="window.print()">Imprimir / Guardar PDF</button></div>${PVI_CERT.renderCertificate(res.certificate)}`;
  }

  return { init, startSkill, selectOption, checkAnswer, downloadReportCSV, downloadReportHTML, issueCertificate };
})();

PVI_APP.init();
