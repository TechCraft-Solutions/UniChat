/**
 * DOMPurify-based HTML sanitization utilities
 * Prevents XSS attacks by sanitizing user-generated content
 */

import DOMPurify from "dompurify";

/**
 * Sanitize HTML content for safe rendering
 * Allows only safe tags and attributes
 */
export function sanitizeHtml(html: string): string {
  if (typeof window === "undefined") {
    // Server-side rendering - return empty string for safety
    return "";
  }

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["b", "i", "em", "strong", "span", "br", "a", "code", "pre"],
    ALLOWED_ATTR: ["href", "target", "rel", "class", "style"],
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "input", "button"],
    FORBID_ATTR: ["onclick", "onerror", "onload", "onmouseover", "onfocus", "onblur"],
  });
}

/**
 * Sanitize text content (escape HTML entities)
 * Use this for plain text that should not contain any HTML
 */
export function sanitizeText(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Sanitize URL for safe use in href attributes
 */
export function sanitizeUrl(url: string): string {
  if (typeof window === "undefined") {
    return "#";
  }

  const sanitized = DOMPurify.sanitize(url, {
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  });

  return sanitized || "#";
}

/**
 * Sanitize markdown-like syntax to safe HTML
 * Converts basic markdown to HTML then sanitizes
 */
export function sanitizeMarkdown(text: string): string {
  // Escape HTML first
  let sanitized = sanitizeText(text);

  // Convert basic markdown to HTML
  sanitized = sanitized
    // Bold: **text** or __text__
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.+?)__/g, "<strong>$1</strong>")
    // Italic: *text* or _text_
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/_(.+?)_/g, "<em>$1</em>")
    // Code: `text`
    .replace(/`(.+?)`/g, "<code>$1</code>")
    // Line breaks
    .replace(/\n/g, "<br>");

  // Final sanitization pass
  return sanitizeHtml(sanitized);
}

/**
 * Check if content contains potentially dangerous HTML
 */
export function containsDangerousHtml(content: string): boolean {
  const dangerousPatterns = [
    /<script/i,
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /javascript:/i,
    /on\w+\s*=/i, // onclick=, onerror=, etc.
    /data:text\/html/i,
  ];

  return dangerousPatterns.some((pattern) => pattern.test(content));
}
