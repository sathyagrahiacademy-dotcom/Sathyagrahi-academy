function option(value) {
  if (value == null || value === '') return null;
  const v = String(value).trim().toUpperCase();
  return ['A','B','C','D'].includes(v) ? v : null;
}

function asMap(rows, key, value) {
  return new Map((rows || []).map(row => [String(row?.[key]), value(row)]));
}

export function gradeQuestions({ questions = [], answerKeys = [], responses = [], negativeMarking = true, totalMarks = 0 } = {}) {
  const keyMap = asMap(answerKeys, 'question_id', row => option(row?.correct_option));
  const responseMap = asMap(responses, 'question_id', row => option(row?.selected_option));
  const questionGrades = [];
  let score = 0, correct = 0, wrong = 0, unattempted = 0;

  for (const question of questions || []) {
    const questionId = String(question?.id ?? '');
    const selected = responseMap.get(questionId) ?? null;
    const correctOption = keyMap.get(questionId) ?? null;
    const maxMarks = Number(question?.marks || 0);
    let state = 'unattempted';
    let earnedMarks = 0;

    if (!selected) {
      unattempted += 1;
    } else if (correctOption && selected === correctOption) {
      state = 'correct';
      correct += 1;
      earnedMarks = maxMarks;
    } else {
      state = 'wrong';
      wrong += 1;
      const penalty = negativeMarking ? Number(question?.negative_marks || 0) : 0;
      earnedMarks = penalty ? -penalty : 0;
    }

    score += earnedMarks;
    questionGrades.push({
      question_id: questionId,
      selected_option: selected,
      correct_option: correctOption,
      state,
      max_marks: maxMarks,
      earned_marks: earnedMarks
    });
  }

  const denominator = Number(totalMarks || 0);
  const percentage = denominator > 0 ? (score / denominator) * 100 : 0;
  return {
    summary: {
      total_score: score,
      correct_count: correct,
      wrong_count: wrong,
      unattempted_count: unattempted,
      percentage
    },
    questionGrades
  };
}
