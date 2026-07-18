// Shared between the client (src/game/nameEntry.ts) and the multiplayer
// server (server/src/index.ts, via relative import -- see server/README.md)
// so a player's display name is held to the same rules everywhere it's
// set, not just wherever happens to run first.

export const MAX_NAME_LENGTH = 16;

// Deliberately not exhaustive -- this catches the common cases without
// trying to be a complete profanity database. Matched against a
// normalized (lowercased, leetspeak-collapsed, non-letters stripped)
// version of the name, so simple obfuscation ("a55hole", "f_u_c_k")
// doesn't slip through.
const BLOCKED_SUBSTRINGS = [
  "fuck",
  "shit",
  "bitch",
  "asshole",
  "bastard",
  "cunt",
  "dick",
  "pussy",
  "nigger",
  "nigga",
  "faggot",
  "fag",
  "retard",
  "whore",
  "slut",
  "rape",
  "nazi",
  "hitler",
];

const LEETSPEAK_MAP: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "@": "a",
  $: "s",
};

function normalize(input: string): string {
  let result = "";
  for (const ch of input.toLowerCase()) {
    result += LEETSPEAK_MAP[ch] ?? ch;
  }
  return result.replace(/[^a-z]/g, "");
}

function containsBlockedWord(name: string): boolean {
  const normalized = normalize(name);
  return BLOCKED_SUBSTRINGS.some((word) => normalized.includes(word));
}

/**
 * Cleans and validates a player-supplied display name: strips
 * control/formatting characters, collapses whitespace, caps length, and
 * rejects profanity. Returns "" if nothing valid is left -- callers treat
 * an empty name the same as "no name chosen yet" (see nameEntry.ts /
 * engine.ts's online-mode name requirement).
 */
export function sanitizeName(raw: string): string {
  const cleaned = raw
    .replace(/[\x00-\x1f\x7f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NAME_LENGTH);
  if (!cleaned || containsBlockedWord(cleaned)) return "";
  return cleaned;
}
