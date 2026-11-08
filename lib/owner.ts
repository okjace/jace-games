/**
 * The site owner: the Jace account that runs Jace Games. It can take Studio
 * games down and give anyone Live XP. Set by SITE_OWNER_JACE_ID, and always
 * includes okjace's account (Jace account ids aren't secret).
 */
const OKJACE = "406a853a-e639-468e-97c8-0794458d909a";

export function isSiteOwner(userId: string | null | undefined): boolean {
  if (!userId) return false;
  const owner = process.env.SITE_OWNER_JACE_ID?.trim();
  return userId === OKJACE || (!!owner && userId === owner);
}
