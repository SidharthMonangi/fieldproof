export const INVITATION_DAYS = 7;

export function invitationCutoff(now = Date.now()): string {
  return new Date(now - INVITATION_DAYS * 24 * 60 * 60 * 1000).toISOString();
}
