/**
 * Converts initials to Title Case (first letter uppercase, rest lowercase)
 * Single characters remain uppercase
 */
function toTitleCase(str: string): string {
  if (str.length <= 1) return str.toUpperCase();
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Generates unique initials for a list of player names
 * Players get the minimum number of prefix characters needed to make all names unique.
 * Falls back to a numeric suffix only for truly identical prefixes (e.g. exact duplicate names).
 * Single letter initials are uppercase, multi-letter initials are Title Case.
 */
export function generateUniqueInitials(names: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  
  // Find the longest name length to cap the search
  const nonEmptyNames = names.filter((n) => n?.trim());
  const maxLen = Math.max(...nonEmptyNames.map((n) => n.trim().length), 1);
  
  // Find the minimum number of characters needed to make all names unique
  let charCount = 1;
  
  while (charCount <= maxLen) {
    const initialsSet = new Set<string>();
    let allUnique = true;
    
    for (const name of names) {
      if (!name) continue;
      const cleanName = name.trim().toUpperCase();
      const initials = cleanName.substring(0, charCount) || '?';
      
      if (initialsSet.has(initials)) {
        allUnique = false;
        break;
      }
      initialsSet.add(initials);
    }
    
    if (allUnique) {
      break;
    }
    charCount++;
  }
  
  // Now generate initials with the determined character count
  const usedInitials = new Set<string>();
  
  names.forEach((name) => {
    if (!name) {
      result[name] = '?';
      return;
    }

    const cleanName = name.trim().toUpperCase();
    let initials = cleanName.substring(0, charCount) || '?';
    
    // Handle edge case where names are still not unique (e.g., exact duplicates)
    if (usedInitials.has(initials)) {
      let counter = 2;
      const prefix = initials.substring(0, Math.max(charCount - 1, 1));
      while (usedInitials.has(`${prefix}${counter}`)) {
        counter++;
      }
      initials = `${prefix}${counter}`;
    }

    usedInitials.add(initials);
    // Apply Title Case for multi-letter initials, keep single letters uppercase
    result[name] = toTitleCase(initials);
  });

  return result;
}
