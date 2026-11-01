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

// ---- Split: posts tagged "activity" (or titled "[Activity] …" / "Activity: …") go to activities.json ----
const ACT_TAG = /^activit(y|ies)$/i;
const ACT_PREFIX = /^\s*(\[activity\]|activity\s*[:\-–—])\s*/i;
const TYPE_WORDS = ['presentation', 'talk', 'keynote', 'webinar', 'workshop', 'training', 'seminar', 'conference', 'event', 'exhibition', 'expo', 'hackathon', 'meetup', 'panel', 'program', 'competition'];
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

// Optional detail lines at the top of an activity post, e.g.
//   Date: 20 Oct 2026   Location: JIExpo, Jakarta   Role: Speaker   Type: Presentation   Organizer: …
const META_KEYS = { date: 'date', when: 'date', location: 'location', where: 'location', venue: 'location', place: 'location',
  role: 'role', type: 'type', organizer: 'organizer', organiser: 'organizer', host: 'organizer', hosted: 'organizer', event: 'event' };
function extractMeta(html) {
  const meta = {};
  let out = html;
  const blocks = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].slice(0, 8);
  for (const b of blocks) {
    const lines = b[1].split(/<br\s*\/?>/i);
    const kept = [];
    for (const line of lines) {
      const text = stripHtml(line).replace(/^[^\p{L}]+/u, '');
      const m = text.match(/^([A-Za-z ]{2,12})\s*[:：]\s*(.+)$/);
      const key = m && META_KEYS[m[1].trim().toLowerCase().split(' ')[0]];
      if (key && !meta[key]) meta[key] = m[2].trim(); else kept.push(line);
    }
    if (kept.length !== lines.length) {
      const rest = kept.join('<br>').trim();
      out = out.replace(b[0], rest && stripHtml(rest) ? `<p>${rest}</p>` : '');
    }
  }
  return { meta, html: out.trim() };
}

const journal = [], activities = [];
for (const p of posts) {
  const isAct = p.tags.some(t => ACT_TAG.test(t.replace(/[#\s]/g, ''))) || ACT_PREFIX.test(p.title);
  if (!isAct) { journal.push(p); continue; }
  const { meta, html } = extractMeta(p.html);
  const d = meta.date ? new Date(meta.date) : null;
  const typeFromTags = p.tags.map(t => t.toLowerCase()).find(t => TYPE_WORDS.includes(t));
  activities.push({
    ...p,
    title: p.title.replace(ACT_PREFIX, ''),
    tags: p.tags.filter(t => !ACT_TAG.test(t.replace(/[#\s]/g, ''))),
    date: d && !isNaN(d) ? ymd(d) : p.date,
    when: d && !isNaN(d) ? '' : (meta.date || ''),
    type: cap(meta.type || typeFromTags || 'Event'),
    role: meta.role || '',
    location: meta.location || '',
    organizer: meta.organizer || meta.event || '',
    html,
  });
}

writeFileSync('posts.json', JSON.stringify(journal, null, 2) + '\n');
writeFileSync('activities.json', JSON.stringify(activities, null, 2) + '\n');
console.log(`Saved ${journal.length} journal post(s) and ${activities.length} activit${activities.length === 1 ? 'y' : 'ies'}:`);
journal.forEach(p => console.log(` - [journal]  ${p.date}  ${p.title}  tags=${JSON.stringify(p.tags)}`));
activities.forEach(a => console.log(` - [activity] ${a.date}  ${a.title}  type=${a.type} role=${a.role} location=${a.location}`));
