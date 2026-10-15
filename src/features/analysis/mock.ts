import { copy } from "@/content";
// Replace this adapter with the real analysis service when its API is agreed.
export const MOCK_RESULT = {
  reason: copy.hungryResult,
  confidence: 80,
  advice: copy.feedingAdvice,
  extra: copy.extraAdvice,
};
