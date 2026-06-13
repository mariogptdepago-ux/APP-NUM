window.PVI_SPACING = (() => {
  const sigmoid = z => 1 / (1 + Math.exp(-z));
  function initialSkillState(skill) {
    return {
      skillId: skill.id,
      label: skill.name,
      correct: 0,
      wrong: 0,
      attempts: 0,
      streak: 0,
      totalMs: 0,
      mastery: sigmoid(-1.25),
      halfLifeHours: 0.12,
      lastPracticeAt: null,
      nextReviewAt: null,
      burnedFamilies: {},
      history: []
    };
  }
  function recall(skillState, now = Date.now()) {
    if (!skillState.lastPracticeAt) return 0;
    const elapsedHours = Math.max(0, (now - new Date(skillState.lastPracticeAt).getTime()) / 3600000);
    return Math.pow(2, -elapsedHours / Math.max(0.03, skillState.halfLifeHours));
  }
  function updateSkill(skillState, question, ok, responseMs) {
    const now = Date.now();
    const before = recall(skillState, now);
    skillState.attempts += 1;
    skillState.totalMs += responseMs;
    if (ok) {
      skillState.correct += 1;
      skillState.streak += 1;
      skillState.halfLifeHours = Math.min(720, skillState.halfLifeHours * (1.55 + 0.06 * question.difficulty) + 0.04);
    } else {
      skillState.wrong += 1;
      skillState.streak = 0;
      skillState.halfLifeHours = Math.max(0.03, skillState.halfLifeHours * 0.55);
    }
    const beta = -1.25 + (question.difficulty <= 2 ? 0.2 : question.difficulty >= 5 ? -0.15 : 0);
    const gamma = 0.86;
    const rho = -1.08;
    skillState.mastery = sigmoid(beta + gamma * skillState.correct + rho * skillState.wrong);
    skillState.lastPracticeAt = new Date(now).toISOString();
    const nextHours = ok ? Math.max(0.25, skillState.halfLifeHours * 0.7) : 0.08;
    skillState.nextReviewAt = new Date(now + nextHours * 3600000).toISOString();
    const rec = { at: skillState.lastPracticeAt, questionId: question.id, familyId: question.familyId, correct: ok, responseMs, recallBefore: before, mastery: skillState.mastery, halfLifeHours: skillState.halfLifeHours };
    skillState.history.push(rec);
    return { recallBefore: before, record: rec };
  }
  function priority(skillState, importance = 1) {
    const D = skillState.mastery || 0;
    const R = recall(skillState);
    const recentErrors = skillState.history.slice(-5).filter(h => !h.correct).length / 5;
    return 0.45 * (1 - D) + 0.35 * (1 - R) + 0.15 * recentErrors + 0.05 * importance;
  }
  function isMastered(skillState) {
    return skillState.attempts >= 20 && skillState.mastery >= 0.85 && recall(skillState) >= 0.75 && skillState.streak >= 3;
  }
  return { initialSkillState, recall, updateSkill, priority, isMastered };
})();
