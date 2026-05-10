export const STAGE_TYPES = [
  "eval",
  "sim_funded",
  "live_funded",
  "payout_active",
  "blown",
  "archived",
] as const;

export type StageType = (typeof STAGE_TYPES)[number];

/**
 * Suggested next-stage progression. Used to label the auto-PROMOTE button.
 * Returns null for terminal states.
 */
export function suggestedNextStage(
  currentStage: string | null,
): StageType | null {
  switch (currentStage) {
    case "eval":
      return "sim_funded";
    case "sim_funded":
      return "live_funded";
    case "live_funded":
      return "payout_active";
    default:
      return null;
  }
}
