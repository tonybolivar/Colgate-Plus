/**
 * Extract the meaningful course code from a Moodle course name or short_name.
 * Moodle names are typically: "Spring 2026 - COSC 208 - Intro to CS - L01"
 * Short names may be: "COSC-208-L01-SP26" or similar.
 * We want: "COSC 208"
 */
export function courseLabel(name: string, shortName?: string | null): string {
  // Try to find a dept+number pattern in the full name first (most reliable)
  const deptMatch = name.match(/\b([A-Z]{2,5})\s*[-–]?\s*(\d{3}[A-Z]?)\b/)
  if (deptMatch) return `${deptMatch[1]} ${deptMatch[2]}`

  // Try short_name — e.g. "COSC-208-L01-SP26" → "COSC 208"
  if (shortName) {
    const shortMatch = shortName.match(/([A-Z]{2,5})[-\s](\d{3}[A-Z]?)/)
    if (shortMatch) return `${shortMatch[1]} ${shortMatch[2]}`
    // If short_name itself is already short enough, use it
    if (shortName.length <= 12) return shortName.toUpperCase()
  }

  // Last resort: take the last meaningful segment of the full name
  const parts = name.split(/[-–|]/).map(s => s.trim()).filter(Boolean)
  const last = parts[parts.length - 1]
  if (last && last.length <= 20) return last.toUpperCase()

  return name.slice(0, 10).toUpperCase()
}

export function moodleCourseUrl(moodleCourseId: number): string {
  return `https://moodle.colgate.edu/course/view.php?id=${moodleCourseId}`
}
