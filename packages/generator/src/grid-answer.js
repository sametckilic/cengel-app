const SOURCE_GRID_ANSWER_PATTERN = /^[A-ZÇĞİÖŞÜÂÎÛ]+$/;

function isSupportedSourceGridAnswer(answer) {
  return (
    typeof answer === 'string' &&
    SOURCE_GRID_ANSWER_PATTERN.test(answer)
  );
}

function normalizeGridAnswer(answer) {
  return answer.replaceAll('Â', 'A').replaceAll('Î', 'İ').replaceAll('Û', 'U');
}

module.exports = {
  isSupportedSourceGridAnswer,
  normalizeGridAnswer,
};
