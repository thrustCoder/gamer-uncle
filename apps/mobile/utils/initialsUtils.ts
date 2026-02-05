/**
 * Generates unique initials for a list of player names
 * All players will have the same number of characters in their initials
 * (the minimum needed to make all names unique)
 */
export function generateUniqueInitials(names: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  
  // Find the minimum number of characters needed to make all names unique
  let charCount = 1;
  const maxCharCount = 3;
  
  while (charCount <= maxCharCount) {
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
      while (usedInitials.has(`${initials.substring(0, 2)}${counter}`)) {
        counter++;
      }
      initials = `${initials.substring(0, 2)}${counter}`;
    }

    usedInitials.add(initials);
    result[name] = initials.substring(0, 3); // Max 3 characters
  });

  return result;
}
