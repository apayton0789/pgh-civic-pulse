/**
 * Lightweight RSS/Atom parser — zero dependencies.
 * Handles both RSS 2.0 (<item>) and Atom (<entry>) feeds.
 */

export interface FeedItem {
  title: string;
  link: string;
  pubDate: string; // ISO string
  description: string;
  creator: string;
  guid: string;
  imageUrl: string;
}

export interface FeedResult {
  channelTitle: string;
  items: FeedItem[];
  fetchedAt: string;
}

function extractTag(xml: string, tag: string): string {
  // Handle both <tag>content</tag> and <tag attr="x">content</tag>
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const m = xml.match(re);
  if (!m) return "";
  let content = m[1].trim();
  // Strip CDATA wrappers (can appear multiple times or be nested)
  content = content.replace(/<!\[CDATA\[/g, "").replace(/\]\]>/g, "");
  return content.trim();
}

function extractAttr(xml: string, tag: string, attr: string): string {
  const re = new RegExp(`<${tag}[^>]*${attr}="([^"]*)"`, "i");
  const m = xml.match(re);
  return m ? m[1] : "";
}

function parseDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString();
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

/** Strip HTML tags and decode common HTML entities */
function stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<!\[CDATA\[/g, "")
    .replace(/\]\]>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseRSS(xml: string): FeedResult {
  const channelTitle = stripHtml(extractTag(xml, "title"));
  const items: FeedItem[] = [];

  // Split by <item> or <entry> tags
  const isAtom = xml.includes("<feed") && xml.includes("<entry>");
  const splitTag = isAtom ? "entry" : "item";
  const parts = xml.split(new RegExp(`<${splitTag}[^>]*>`, "i"));

  for (let i = 1; i < parts.length; i++) {
    const block = parts[i].split(new RegExp(`</${splitTag}>`, "i"))[0];

    const title = stripHtml(extractTag(block, isAtom ? "title" : "title"));
    const link = isAtom
      ? extractAttr(block, 'link rel="alternate"', "href") || extractAttr(block, "link", "href")
      : extractTag(block, "link");
    const pubDate = parseDate(
      extractTag(block, isAtom ? "published" : "pubDate") ||
      extractTag(block, "updated")
    );
    const rawDescription = extractTag(block, isAtom ? "media:description" : "description") ||
      extractTag(block, "content:encoded") ||
      extractTag(block, "summary") || "";
    const description = stripHtml(rawDescription);
    const creator = stripHtml(
      extractTag(block, "dc:creator") ||
      extractTag(block, "author") || ""
    );
    const guid = extractTag(block, isAtom ? "id" : "guid") || link;
    const imageUrl = extractAttr(block, "enclosure", "url") ||
      extractAttr(block, "media:thumbnail", "url") || "";

    if (title) {
      items.push({ title, link, pubDate, description, creator, guid, imageUrl });
    }
  }

  return { channelTitle, items, fetchedAt: new Date().toISOString() };
}
