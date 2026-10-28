import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.resolve(here, '../../icons');

const TILE = 256;
const GAP = 44;
const TILE_FILL = '#242938';
const FONT = "'Segoe UI',Helvetica,Arial,sans-serif";

const skill = id => ({ kind: 'skill', id });
const devicon = (name, variant = 'original', caption, color) => ({ kind: 'devicon', name, variant, caption, color });
const simple = (slug, color, caption) => ({ kind: 'simple', slug, color, caption });
const text = (lines, color) => ({ kind: 'text', lines, color });

const rows = {
  languages: [
    skill('cs'), skill('java'), skill('js'), skill('ts'), skill('html'), skill('css'),
    skill('py'), skill('bash'), skill('powershell'), skill('cpp'), skill('kotlin'), skill('dart'),
  ],
  backend: [
    skill('dotnet'), text(['ASP.NET', 'Core'], '#8B6CF0'), devicon('entityframeworkcore'),
    text(['LINQ'], '#8B6CF0'), devicon('swagger'), devicon('openapi'), text(['SOAP'], '#60A5FA'),
    text(['gRPC'], '#4DB6AC'), text(['SignalR'], '#38BDF8'), skill('kafka'), skill('graphql'), skill('postman'),
    skill('nodejs'), devicon('jwt'), devicon('oauth', 'plain', undefined, '#EB5424'),
  ],
  frontend: [
    skill('react'), skill('nextjs'), skill('tailwind'), skill('bootstrap'), skill('figma'),
    devicon('blazor'), text(['Win', 'Forms'], '#60A5FA'), simple('devexpress', '#FF7200'),
    simple('strapi', '#8E75FF'), skill('flutter'), skill('androidstudio'),
  ],
  databases: [
    devicon('microsoftsqlserver', 'plain'), skill('postgres'), skill('mysql'), text(['Oracle'], '#FF4D4D'),
    simple('clickhouse', '#FFCC01'), skill('mongodb'), skill('redis'), skill('sqlite'), devicon('dynamodb'),
    text(['SSRS'], '#F29D38'), text(['SSIS'], '#3B82F6'), text(['Crystal', 'Reports'], '#38BDF8'),
    simple('powerbi', '#F2C811'),
  ],
  cloud: [
    skill('azure'), skill('aws'), skill('gcp'), skill('cloudflare'), skill('ubuntu'), skill('windows'),
    devicon('windows11', 'original', 'Server'), text(['IIS'], '#3B82F6'),
    devicon('cloudflare', 'original', 'Turnstile'), devicon('google', 'original', 'reCAPTCHA'),
  ],
  devops: [
    skill('docker'), skill('kubernetes'), skill('jenkins'), skill('githubactions'),
    devicon('azuredevops'), skill('terraform'), skill('ansible'), skill('nginx'),
    skill('prometheus'), skill('grafana'), devicon('opentelemetry'), text(['TFS'], '#A78BFA'),
  ],
  testing: [
    text(['xUnit'], '#E879F9'), text(['Moq'], '#8B6CF0'), skill('cypress'), skill('sentry'),
  ],
  services: [
    skill('supabase'), skill('firebase'), simple('amazoncognito', '#DD344C'), simple('stripe', '#635BFF'),
    text(['Dragon', 'Pay'], '#EF4444'), simple('amazonsimpleemailservice', '#DD344C'),
    simple('amazonwebservices', '#FF9900', 'SNS'),
  ],
  tools: [
    skill('git'), skill('github'), skill('bitbucket'), skill('visualstudio'), skill('vscode'),
    simple('resharper', '#E14CE1'), simple('cursor', '#FFFFFF'), devicon('jira'), devicon('confluence'),
    simple('microsoftteams', '#7B83EB'), text(['monday'], '#FF3D57'), simple('diagramsdotnet', '#F08705'),
  ],
  ai: [
    simple('githubcopilot', '#FFFFFF'), devicon('claude'), simple('openai', '#FFFFFF'),
    simple('googlegemini', '#8E75B2'),
  ],
};

let idCounter = 0;

fs.mkdirSync(outputDir, { recursive: true });

for (const [name, items] of Object.entries(rows)) {
  const tiles = [];
  for (let i = 0; i < items.length; i++) {
    tiles.push(await tile(items[i], i * (TILE + GAP)));
  }
  const width = items.length * TILE + (items.length - 1) * GAP;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${Math.round(width * 48 / TILE)}" height="48" viewBox="0 0 ${width} ${TILE}" fill="none">${tiles.join('')}</svg>\n`;
  fs.writeFileSync(path.join(outputDir, `${name}.svg`), svg);
  console.log(`icons/${name}.svg  ${items.length} tiles`);
}

async function tile(item, x) {
  if (item.kind === 'skill') {
    const source = await download(`https://skillicons.dev/icons?i=${item.id}`);
    return nest(source, x, 0, TILE, TILE);
  }

  const background = `<rect x="${x}" width="${TILE}" height="${TILE}" rx="60" fill="${TILE_FILL}"/>`;

  if (item.kind === 'text') {
    return background + textLines(item.lines, item.color, x);
  }

  const logoSize = item.caption ? 120 : 160;
  const logoX = x + (TILE - logoSize) / 2;
  const logoY = item.caption ? 26 : (TILE - logoSize) / 2;
  let logo;

  if (item.kind === 'devicon') {
    const source = await download(`https://cdn.jsdelivr.net/gh/devicons/devicon/icons/${item.name}/${item.name}-${item.variant}.svg`);
    logo = nest(item.color ? source.replace('<svg', `<svg fill="${item.color}"`) : source, logoX, logoY, logoSize, logoSize);
  } else {
    const source = await download(`https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/${item.slug}.svg`);
    logo = nest(source.replace('<svg', `<svg fill="${item.color}"`), logoX, logoY, logoSize, logoSize);
  }

  const caption = item.caption
    ? `<text x="${x + TILE / 2}" y="214" text-anchor="middle" font-family="${FONT}" font-size="${item.caption.length > 7 ? 44 : 56}" font-weight="700" fill="#E5E7EB">${item.caption}</text>`
    : '';

  return background + logo + caption;
}

function textLines(lines, color, x) {
  const longest = Math.max(...lines.map(line => line.length));
  const fontSize = lines.length === 1
    ? Math.min(110, Math.floor(200 / (longest * 0.62)))
    : Math.min(72, Math.floor(200 / (longest * 0.62)));
  const lineHeight = fontSize * 1.1;
  const firstBaseline = TILE / 2 - ((lines.length - 1) * lineHeight) / 2 + fontSize * 0.35;

  return lines.map((line, i) =>
    `<text x="${x + TILE / 2}" y="${(firstBaseline + i * lineHeight).toFixed(1)}" text-anchor="middle" font-family="${FONT}" font-size="${fontSize}" font-weight="800" fill="${color}">${line}</text>`
  ).join('');
}

function nest(source, x, y, width, height) {
  const cleaned = prefixIds(source.replace(/<\?xml[^>]*>/g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/<!DOCTYPE[^>]*>/gi, ''));
  const open = cleaned.match(/<svg\b[^>]*>/)[0];
  const inner = cleaned.slice(cleaned.indexOf(open) + open.length, cleaned.lastIndexOf('</svg>'));
  const viewBox = attribute(open, 'viewBox') ?? `0 0 ${parseFloat(attribute(open, 'width'))} ${parseFloat(attribute(open, 'height'))}`;
  const fill = attribute(open, 'fill');
  const fillAttribute = fill ? ` fill="${fill}"` : '';
  return `<svg x="${x}" y="${y}" width="${width}" height="${height}" viewBox="${viewBox}"${fillAttribute}>${inner}</svg>`;
}

function prefixIds(source) {
  const prefix = `i${idCounter++}_`;
  const ids = [...source.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  let result = source;
  for (const id of ids) {
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result
      .replace(new RegExp(`\\bid="${escaped}"`, 'g'), `id="${prefix}${id}"`)
      .replace(new RegExp(`url\\(#${escaped}\\)`, 'g'), `url(#${prefix}${id})`)
      .replace(new RegExp(`href="#${escaped}"`, 'g'), `href="#${prefix}${id}"`);
  }
  return result;
}

function attribute(tag, name) {
  const match = tag.match(new RegExp(`\\s${name}="([^"]*)"`));
  return match ? match[1] : null;
}

async function download(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${response.status} ${url}`);
  }
  return response.text();
}
