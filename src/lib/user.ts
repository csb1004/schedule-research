const SHORT_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function createShortCode(random = Math.random): string {
  let code = "";

  for (let index = 0; index < 4; index += 1) {
    const charIndex = Math.floor(random() * SHORT_CODE_ALPHABET.length);
    code += SHORT_CODE_ALPHABET[charIndex];
  }

  return code;
}

export function formatDisplayUser(displayName: string, shortCode: string): string {
  return `${displayName} #${shortCode}`;
}

