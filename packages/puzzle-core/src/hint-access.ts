export type AnswerRevealAccessRequest = {
  puzzleId: string;
  wordId: string;
};

export type AnswerRevealAccessResult =
  | { granted: true; source: 'prototype' | 'rewarded-ad' }
  | { granted: false; reason: 'cancelled' | 'failed' | 'unavailable' };

export type AnswerRevealAccessProvider = {
  requestAccess: (
    request: AnswerRevealAccessRequest,
  ) => Promise<AnswerRevealAccessResult>;
};

export const prototypeAnswerRevealAccessProvider: AnswerRevealAccessProvider = {
  async requestAccess() {
    return { granted: true, source: 'prototype' };
  },
};
