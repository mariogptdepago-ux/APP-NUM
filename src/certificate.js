window.PVI_CERT = (() => {
  function randomBlock(size = 4) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: size }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }
  function localDemoCertificate(payload) {
    const year = new Date().getFullYear();
    const axisCode = payload.axisId?.split('_').map(x => x[0]).join('').toUpperCase().slice(0,3) || 'LIM';
    const certificateId = `${PVI_CONFIG.INSTITUTION_CODE}-${axisCode}-${year}-${payload.grade}-${randomBlock()}-${randomBlock()}-DEMO`;
    const certificate = {
      certificateId,
      studentId: payload.studentId,
      studentName: payload.studentName,
      grade: payload.grade,
      axisId: payload.axisId,
      axisName: payload.axisName,
      descriptors: payload.descriptors.join('|'),
      mastery: payload.mastery,
      retrievability: payload.retrievability,
      issuedAt: new Date().toLocaleString('es-CO'),
      issuedBy: 'local_demo',
      status: 'demo_local',
      signatureHash: 'solo_apps_script_emite_firma_real'
    };
    const rows = JSON.parse(localStorage.getItem('pvi_certificates') || '[]');
    rows.push(certificate);
    localStorage.setItem('pvi_certificates', JSON.stringify(rows));
    return { ok: true, certificate, message: 'Certificado demo generado localmente. Para verificación real use Apps Script.' };
  }
  function renderCertificate(certificate) {
    const verifyUrl = `${location.origin}${location.pathname.replace('index.html','')}verificar.html?code=${encodeURIComponent(certificate.certificateId)}`;
    return `
      <div class="diploma">
        <div class="watermark">PABLO VI</div>
        <h1>Mini diploma verificable</h1>
        <p>El ${PVI_CONFIG.INSTITUTION_NAME} certifica que:</p>
        <h2>${certificate.studentName}</h2>
        <p><strong>Grado:</strong> ${certificate.grade}</p>
        <p>ha demostrado dominio en el eje temático:</p>
        <h2>${certificate.axisName}</h2>
        <p><strong>Descriptores abarcados:</strong><br>${String(certificate.descriptors).replaceAll('|','<br>')}</p>
        <p><strong>Fecha de obtención:</strong> ${certificate.issuedAt}</p>
        <p><strong>Dominio:</strong> ${Math.round(Number(certificate.mastery || 0) * 100)}% · <strong>Recuperabilidad:</strong> ${Math.round(Number(certificate.retrievability || 0) * 100)}%</p>
        <div class="codebox">Código único: ${certificate.certificateId}</div>
        <p class="codebox">Verificación: ${verifyUrl}</p>
        <p><small>Este diploma debe validarse contra el registro maestro institucional. La trama visual no sustituye la verificación del código.</small></p>
      </div>
    `;
  }
  return { localDemoCertificate, renderCertificate };
})();
