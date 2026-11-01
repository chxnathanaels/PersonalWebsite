// Reads the public RSS feed of a Hashnode blog and writes posts.json for the site.
// No API key needed. Usage: HASHNODE_HOST=name.hashnode.dev node sync-hashnode.mjs
import { writeFileSync } from 'node:fs';

const host = process.env.HASHNODE_HOST;
const feedUrl = process.env.FEED_URL || `https://${host}/rss.xml`;

const res = await fetch(feedUrl, { headers: { 'User-Agent': 'personal-site-sync (GitHub Actions)' } });
const xml = await res.text();
console.log(`GET ${res.url} -> HTTP ${res.status}, ${xml.length} bytes`);
if (!res.ok || !/<rss|<feed/i.test(xml)) {
  console.error('Not an RSS feed. First 500 chars:\n' + xml.slice(0, 500));
  process.exit(1);
}

const decode = (s = '') =>
  s.replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1')
   .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&')
   .trim();
const tag = (block, name) => {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? decode(m[1]) : '';
};
const tags = (block, name) =>
  [...block.matchAll(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'gi'))].map(m => decode(m[1])).filter(Boolean);
const attr = (block, name, a) => {
  const m = block.match(new RegExp(`<${name}\\s[^>]*${a}="([^"]+)"`, 'i'));
  return m ? decode(m[1]) : null;
};
const stripHtml = s => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(m => m[1]);
const posts = items.map(it => {
  const link = tag(it, 'link');
  const html = tag(it, 'content:encoded') || tag(it, 'description');
  const desc = stripHtml(tag(it, 'description'));
  const date = new Date(tag(it, 'pubDate') || Date.now());
  const firstImg = (html.match(/<img[^>]+src="([^"]+)"/i) || [])[1] || null;
  return {
    title: tag(it, 'title'),
    slug: link.split('/').filter(Boolean).pop() || '',
    url: link,
    date: isNaN(date) ? '' : date.toISOString().slice(0, 10),
    excerpt: desc.length > 220 ? desc.slice(0, 217) + '…' : desc,
    tags: tags(it, 'category'),
    cover: tag(it, 'hashnode:coverImage') || attr(it, 'media:content', 'url') || attr(it, 'enclosure', 'url') || tag(it, 'cover_image') || firstImg,
    html,
  };
}).filter(p => p.title && p.url);

writeFileSync('posts.json', JSON.stringify(posts, null, 2) + '\n');
console.log(`Saved ${posts.length} post(s):`);
posts.forEach(p => console.log(` - ${p.date}  ${p.title}  (${p.html.length} chars of HTML${p.cover ? ', cover' : ''})`));
