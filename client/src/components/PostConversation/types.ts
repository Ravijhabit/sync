export interface LearningSubmitProps {
  matchId: string;
  targetId: string;
  onSubmitted: () => void;
}

export interface LearningReviewProps {
  learningId: string;
  onReviewed: () => void;
}

export interface MeaningfulFlagProps {
  matchId: string;
}
