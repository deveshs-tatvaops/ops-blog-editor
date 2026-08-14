import { marked } from 'marked';

marked.setOptions({ gfm: true, breaks: false });

export function renderMarkdown(md: string): string {
  return marked.parse(md || '', { async: false }) as string;
}

export function countWords(md: string): number {
  const text = (md || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~\-|]/g, ' ');
  const words = text.split(/\s+/).filter(Boolean);
  return words.length;
}

/** 225 wpm, rounded up, floor of 1 minute for any non-empty post. */
export function readingTime(words: number): number {
  if (words <= 0) return 0;
  return Math.max(1, Math.ceil(words / 225));
}

export interface MdImage {
  alt: string;
  src: string;
}

export function extractImages(md: string): MdImage[] {
  const out: MdImage[] = [];
  const mdRe = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let m: RegExpExecArray | null;
  while ((m = mdRe.exec(md || ''))) out.push({ alt: m[1].trim(), src: m[2] });
  const htmlRe = /<img\b[^>]*>/gi;
  while ((m = htmlRe.exec(md || ''))) {
    const tag = m[0];
    const alt = /alt\s*=\s*"([^"]*)"/i.exec(tag)?.[1] ?? '';
    const src = /src\s*=\s*"([^"]*)"/i.exec(tag)?.[1] ?? '';
    out.push({ alt: alt.trim(), src });
  }
  return out;
}

export interface MdLink {
  text: string;
  href: string;
}

export function extractLinks(md: string): MdLink[] {
  const out: MdLink[] = [];
  const re = /(?<!!)\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md || ''))) out.push({ text: m[1].trim(), href: m[2] });
  const htmlRe = /<a\b[^>]*href\s*=\s*"([^"]*)"[^>]*>(.*?)<\/a>/gi;
  while ((m = htmlRe.exec(md || ''))) out.push({ href: m[1], text: m[2].replace(/<[^>]+>/g, '').trim() });
  return out;
}

export interface Heading {
  level: number;
  text: string;
}

export function extractHeadings(md: string): Heading[] {
  const out: Heading[] = [];
  for (const line of (md || '').split('\n')) {
    const m = /^(#{1,6})\s+(.*)$/.exec(line.trim());
    if (m) out.push({ level: m[1].length, text: m[2].trim() });
  }
  return out;
}

/** Plain text with markdown syntax stripped — used for keyword proximity checks. */
export function toPlainText(md: string): string {
  return (md || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^[#>\s]*/gm, '')
    .replace(/[*_`~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function firstWords(md: string, n: number): string {
  return toPlainText(md).split(/\s+/).slice(0, n).join(' ');
}

/** Adds ids to h2/h3 so the public page can render an anchor-linked outline. */
export function withHeadingIds(html: string): string {
  return html.replace(/<h([23])>(.*?)<\/h\1>/g, (_all, lvl: string, inner: string) => {
    const id = inner
      .replace(/<[^>]+>/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');
    return `<h${lvl} id="${id}">${inner}</h${lvl}>`;
  });
}
