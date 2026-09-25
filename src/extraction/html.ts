function decodeEntity(entity: string): string {
  switch (entity.toLowerCase()) {
    case "&nbsp;":
      return " ";
    case "&amp;":
      return "&";
    case "&quot;":
      return '"';
    case "&#39;":
    case "&apos;":
      return "'";
    case "&lt;":
      return "<";
    case "&gt;":
      return ">";
    default: {
      const decimal = entity.match(/^&#(\d+);$/);
      if (decimal) {
        return String.fromCodePoint(Number(decimal[1]));
      }

      const hex = entity.match(/^&#x([0-9a-f]+);$/i);
      if (hex) {
        return String.fromCodePoint(parseInt(hex[1], 16));
      }

      return entity;
    }
  }
}

export function decodeSnapshotBody(
  bytes: ArrayBuffer,
  contentType: string | null,
): string {
  const charset = contentType
    ?.match(/charset\s*=\s*["']?([^;"'\s]+)/i)?.[1]
    ?.trim();

  try {
    return new TextDecoder(charset || "utf-8").decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

export function htmlToText(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(?:#\d+|#x[0-9a-f]+|nbsp|amp|quot|apos|lt|gt);/gi, decodeEntity)
    .replace(/\s+/g, " ")
    .trim();
}

export function extractHtmlTitle(html: string): string | null {
  const match = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return null;

  return htmlToText(match[1]).slice(0, 300) || null;
}

export function normalizedEvidenceText(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}
