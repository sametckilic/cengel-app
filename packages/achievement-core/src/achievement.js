const ACHIEVEMENT_DEFINITIONS = [
  {
    description: 'İlk bulmacanı tamamla.',
    id: 'first-completion',
    target: 1,
    title: 'İlk Çözüm',
    type: 'completion',
  },
  {
    description: 'Bir bulmacayı ipucu kullanmadan tamamla.',
    id: 'no-hint-completion',
    target: 1,
    title: 'İpucusuz',
    type: 'no-hint-completion',
  },
  {
    description: 'Art arda 3 Günün Bulmacası’nı tamamla.',
    id: 'daily-streak-3',
    target: 3,
    title: '3 Günlük Seri',
    type: 'daily-streak',
  },
  {
    description: 'Art arda 7 Günün Bulmacası’nı tamamla.',
    id: 'daily-streak-7',
    target: 7,
    title: '7 Günlük Seri',
    type: 'daily-streak',
  },
];

const DAILY_PUZZLE_ID_PATTERN = /^gunun-(\d{4}-\d{2}-\d{2})$/;
const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

function createPuzzleCompletionEvidence(
  puzzle,
  progress,
  validationMode = 'offline-casual',
) {
  if (progress.puzzleId !== puzzle.id || puzzle.words.length === 0) {
    return null;
  }

  const solvedWordIds = new Set(progress.solvedWordIds);

  if (!puzzle.words.every(({ id }) => solvedWordIds.has(id))) {
    return null;
  }

  return {
    completedAt: progress.updatedAt,
    puzzleId: puzzle.id,
    usedHint: progress.revealedWordIds.length > 0,
    validationMode,
  };
}

function verificationFor(completions) {
  return completions.every(({ validationMode }) => validationMode === 'server-verified')
    ? 'verified'
    : 'casual';
}

function compareCompletions(left, right) {
  return (
    left.completedAt.localeCompare(right.completedAt) ||
    left.puzzleId.localeCompare(right.puzzleId)
  );
}

function getDailyDateKey(puzzleId) {
  const match = DAILY_PUZZLE_ID_PATTERN.exec(puzzleId);

  if (!match) {
    return null;
  }

  const dateKey = match[1];
  const parsed = Date.parse(`${dateKey}T00:00:00.000Z`);

  return Number.isNaN(parsed) || new Date(parsed).toISOString().slice(0, 10) !== dateKey
    ? null
    : dateKey;
}

function areConsecutiveDates(left, right) {
  return (
    Date.parse(`${right}T00:00:00.000Z`) - Date.parse(`${left}T00:00:00.000Z`) ===
    DAY_IN_MILLISECONDS
  );
}

function getDailyCompletions(completions) {
  const completionByDate = new Map();

  for (const completion of completions) {
    const dateKey = getDailyDateKey(completion.puzzleId);

    if (!dateKey) {
      continue;
    }

    const current = completionByDate.get(dateKey);

    if (!current || compareCompletions(completion, current) < 0) {
      completionByDate.set(dateKey, completion);
    }
  }

  return [...completionByDate.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([dateKey, completion]) => ({ completion, dateKey }));
}

function evaluateDailyStreak(completions, target) {
  const dailyCompletions = getDailyCompletions(completions);
  const candidates = [];

  for (let start = 0; start <= dailyCompletions.length - target; start += 1) {
    const streak = dailyCompletions.slice(start, start + target);
    const consecutive = streak.every(
      ({ dateKey }, index) =>
        index === 0 || areConsecutiveDates(streak[index - 1].dateKey, dateKey),
    );

    if (!consecutive) {
      continue;
    }

    const evidence = streak.map(({ completion }) => completion);
    candidates.push({
      achievementId: target === 3 ? 'daily-streak-3' : 'daily-streak-7',
      earnedAt: evidence.map(({ completedAt }) => completedAt).sort().at(-1),
      evidencePuzzleIds: evidence.map(({ puzzleId }) => puzzleId),
      verification: verificationFor(evidence),
    });
  }

  return candidates.sort((left, right) => left.earnedAt.localeCompare(right.earnedAt))[0] ?? null;
}

function evaluateAchievements(completionEvidence) {
  const completions = [...completionEvidence].sort(compareCompletions);
  const earned = [];
  const firstCompletion = completions[0];
  const firstNoHintCompletion = completions.find(({ usedHint }) => !usedHint);

  if (firstCompletion) {
    earned.push({
      achievementId: 'first-completion',
      earnedAt: firstCompletion.completedAt,
      evidencePuzzleIds: [firstCompletion.puzzleId],
      verification: verificationFor([firstCompletion]),
    });
  }

  if (firstNoHintCompletion) {
    earned.push({
      achievementId: 'no-hint-completion',
      earnedAt: firstNoHintCompletion.completedAt,
      evidencePuzzleIds: [firstNoHintCompletion.puzzleId],
      verification: verificationFor([firstNoHintCompletion]),
    });
  }

  const threeDayStreak = evaluateDailyStreak(completions, 3);
  const sevenDayStreak = evaluateDailyStreak(completions, 7);

  if (threeDayStreak) {
    earned.push(threeDayStreak);
  }

  if (sevenDayStreak) {
    earned.push(sevenDayStreak);
  }

  return earned;
}

module.exports = {
  ACHIEVEMENT_DEFINITIONS,
  createPuzzleCompletionEvidence,
  evaluateAchievements,
};
