/**
 * YouTube URL parsing utility
 * Unified extraction of video IDs from various YouTube URL formats and plain IDs
 */

const VIDEO_ID_REGEX = /^([a-zA-Z0-9_-]{11})$/;

/**
 * Extract YouTube video ID from various URL formats or plain ID
 *
 * Supported formats:
 * - youtu.be/{id} (short URL)
 * - youtube.com/watch?v={id} (standard watch)
 * - youtube.com/v/{id} (embed video)
 * - youtube.com/embed/{id} (embed iframe)
 * - youtube.com/shorts/{id} (shorts)
 * - youtube.com/live/{id} (live)
 * - studio.youtube.com/watch?v={id} (YouTube Studio)
 * - v:{id} prefix (for legacy support)
 * - Plain 11-character video ID
 *
 * @param input - URL string or video ID to parse
 * @returns Video ID if found, null otherwise
 */
export function extractYoutubeVideoId(input: string): string | null {
  if (!input || typeof input !== "string") {
    return null;
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  // Handle v: prefix (from youtube-chat.service.ts normalizeVideoId)
  const noPrefix = trimmed.replace(/^v:/i, "");

  // Check for plain 11-char video ID (with or without v: prefix)
  if (VIDEO_ID_REGEX.test(noPrefix)) {
    return noPrefix;
  }

  // Try to parse as URL
  let url: URL;
  try {
    // Handle URLs that might not have protocol
    let urlCandidate = noPrefix;
    if (!urlCandidate.startsWith("http://") && !urlCandidate.startsWith("https://")) {
      if (
        urlCandidate.startsWith("youtu.be") ||
        urlCandidate.startsWith("youtube.com") ||
        urlCandidate.startsWith("www.youtube.com") ||
        urlCandidate.startsWith("studio.youtube.com")
      ) {
        urlCandidate = "https://" + urlCandidate;
      }
    }
    url = new URL(urlCandidate);
  } catch {
    // Not a valid URL, return null (already checked for plain ID above)
    return null;
  }

  const host = url.hostname.toLowerCase();
  const path = url.pathname;

  // Handle youtu.be (short URL)
  if (host === "youtu.be") {
    const seg = path.split("/").filter(Boolean)[0];
    if (seg && VIDEO_ID_REGEX.test(seg)) {
      return seg;
    }
    return null;
  }

  // Handle youtube.com and subdomains
  if (host === "youtube.com" || host.endsWith(".youtube.com")) {
    // Check query parameter v=
    const queryV = url.searchParams.get("v");
    if (queryV && VIDEO_ID_REGEX.test(queryV)) {
      return queryV;
    }

    // Check path patterns
    const pathMatch = path.match(/^\/(embed|v|watch|shorts|live)\/([a-zA-Z0-9_-]{11})(?:\/|\?|$)/i);
    if (pathMatch?.[2]) {
      return pathMatch[2];
    }
  }

  return null;
}
