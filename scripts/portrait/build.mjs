import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.resolve(here, '../../portrait.svg');
const photoPath = process.argv[2];

if (!photoPath) {
  console.error('Usage: npm run build -- <path to photo>');
  process.exit(1);
}

const GRID_WIDTH = 300;
const GRID_HEIGHT = 369;
const MAX_RUN = 4;
const PHOTO_CROP = { left: 364, top: 200, width: 2073, height: 2548 };
const LOGO_SIZE = 230;
const LOGO_DENSITY = 0.6;

const email = 'dennis.jayvee.patricio.03@gmail.com';

const infoLines = [
  ['Subject', 'Dennis Jayvee Patricio'],
  ['Role', 'Senior Software Engineer | Full Stack .NET'],
  ['Origin', 'Bulacan, Philippines'],
  ['Education', 'BS Information System, TUP Manila'],
  ['Status', 'Working | Studying AI, Cybersecurity, Backend'],
  ['ToolChain', 'Visual Studio, VS Code, Git, Docker'],
];

const coreLines = [
  ['Core.Lang', 'C#, TypeScript, JavaScript, SQL'],
  ['Core.Frontend', 'React, Next.js, Blazor, Tailwind'],
  ['Core.Backend', 'ASP.NET Core Web API, EF Core, LINQ'],
  ['Core.Database', 'SQL Server, PostgreSQL, Redis'],
  ['Core.Infra', 'Azure, Docker, Kubernetes, Azure Pipelines'],
];

const contactLines = [
  ['Grid.Mail', email],
  ['Grid.Resume', 'tinyurl.com/djp-resume-new-latest-2026'],
  ['Grid.LinkedIn', 'tinyurl.com/djp-linkedin'],
  ['Grid.GitHub', '@djdpatricio'],
  ['Grid.TechStack', 'tinyurl.com/djp-techstack'],
];

const random = seededRandom(20261028);

const portrait = await portraitFrame();
const csharp = await logoFrame(path.join(here, 'logos/csharp.svg'));
const dotnet = await logoFrame(path.join(here, 'logos/dotnet.svg'));

const segmentCount = Math.max(portrait.segments.length, csharp.length, dotnet.length);
const portraitSegments = padSegments(portrait.segments, segmentCount);
const csharpSegments = padSegments(csharp, segmentCount);
const dotnetSegments = padSegments(dotnet, segmentCount);
const noiseSegments = noiseFrame(segmentCount);

const frames = [
  noiseSegments,
  portraitSegments,
  portraitSegments,
  csharpSegments,
  csharpSegments,
  dotnetSegments,
  dotnetSegments,
  noiseSegments,
  noiseSegments,
].map(toPathData);

fs.writeFileSync(outputPath, buildSvg(frames, portrait.outline));
console.log(`Wrote ${outputPath} with ${segmentCount} segments per frame`);

function seededRandom(seed) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function portraitFrame() {
  const { data } = await sharp(photoPath)
    .rotate()
    .extract(PHOTO_CROP)
    .resize(GRID_WIDTH, GRID_HEIGHT, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixelCount = GRID_WIDTH * GRID_HEIGHT;
  const isBackground = findBackground(data);
  const tone = new Float32Array(pixelCount);
  const subjectTones = [];

  for (let i = 0; i < pixelCount; i++) {
    if (isBackground[i]) {
      continue;
    }
    const red = data[i * 3];
    const green = data[i * 3 + 1];
    const blue = data[i * 3 + 2];
    tone[i] = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
    subjectTones.push(tone[i]);
  }

  subjectTones.sort((a, b) => a - b);
  const low = subjectTones[Math.floor(subjectTones.length * 0.02)];
  const high = subjectTones[Math.floor(subjectTones.length * 0.98)];

  for (let i = 0; i < pixelCount; i++) {
    if (isBackground[i]) {
      continue;
    }
    const stretched = Math.min(1, Math.max(0, (tone[i] - low) / (high - low)));
    tone[i] = Math.pow(stretched, 1.6);
  }

  const on = floydSteinberg(tone, isBackground);
  return { segments: toSegments(on), outline: headOutline(isBackground) };
}

function findBackground(rgb) {
  const isBackground = new Uint8Array(GRID_WIDTH * GRID_HEIGHT);
  const isLight = index => Math.min(rgb[index * 3], rgb[index * 3 + 1], rgb[index * 3 + 2]) > 215;
  const queue = [];

  for (let x = 0; x < GRID_WIDTH; x++) {
    queue.push(x, (GRID_HEIGHT - 1) * GRID_WIDTH + x);
  }
  for (let y = 0; y < GRID_HEIGHT; y++) {
    queue.push(y * GRID_WIDTH, y * GRID_WIDTH + GRID_WIDTH - 1);
  }

  while (queue.length > 0) {
    const index = queue.pop();
    if (isBackground[index] || !isLight(index)) {
      continue;
    }
    isBackground[index] = 1;
    const x = index % GRID_WIDTH;
    const y = Math.floor(index / GRID_WIDTH);
    if (x > 0) queue.push(index - 1);
    if (x < GRID_WIDTH - 1) queue.push(index + 1);
    if (y > 0) queue.push(index - GRID_WIDTH);
    if (y < GRID_HEIGHT - 1) queue.push(index + GRID_WIDTH);
  }

  return isBackground;
}

function floydSteinberg(tone, isBackground) {
  const values = Float32Array.from(tone);
  const on = new Uint8Array(values.length);

  for (let y = 0; y < GRID_HEIGHT; y++) {
    const leftToRight = y % 2 === 0;
    for (let step = 0; step < GRID_WIDTH; step++) {
      const x = leftToRight ? step : GRID_WIDTH - 1 - step;
      const index = y * GRID_WIDTH + x;
      if (isBackground[index]) {
        continue;
      }
      const value = values[index];
      on[index] = value >= 0.5 ? 1 : 0;
      const error = value - on[index];
      const forward = leftToRight ? 1 : -1;
      spreadError(values, isBackground, x + forward, y, error * 7 / 16);
      spreadError(values, isBackground, x - forward, y + 1, error * 3 / 16);
      spreadError(values, isBackground, x, y + 1, error * 5 / 16);
      spreadError(values, isBackground, x + forward, y + 1, error * 1 / 16);
    }
  }

  return on;
}

function spreadError(values, isBackground, x, y, amount) {
  if (x < 0 || x >= GRID_WIDTH || y >= GRID_HEIGHT) {
    return;
  }
  const index = y * GRID_WIDTH + x;
  if (!isBackground[index]) {
    values[index] += amount;
  }
}

function headOutline(isBackground) {
  const neckRow = Math.round(GRID_HEIGHT * 0.56);
  const left = [];
  const right = [];

  for (let y = 0; y <= neckRow; y += 4) {
    let first = -1;
    let last = -1;
    for (let x = 0; x < GRID_WIDTH; x++) {
      if (!isBackground[y * GRID_WIDTH + x]) {
        if (first < 0) first = x;
        last = x;
      }
    }
    if (first >= 0) {
      left.push([first, y]);
      right.push([last, y]);
    }
  }

  const points = [...right.reverse(), ...left];
  return points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ');
}

async function logoFrame(file) {
  const { data } = await sharp(fs.readFileSync(file), { density: 600 })
    .resize(LOGO_SIZE, LOGO_SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .extractChannel('alpha')
    .raw()
    .toBuffer({ resolveWithObject: true });

  const on = new Uint8Array(GRID_WIDTH * GRID_HEIGHT);
  const offsetX = Math.round((GRID_WIDTH - LOGO_SIZE) / 2);
  const offsetY = Math.round((GRID_HEIGHT - LOGO_SIZE) / 2);

  for (let y = 0; y < LOGO_SIZE; y++) {
    for (let x = 0; x < LOGO_SIZE; x++) {
      const coverage = data[y * LOGO_SIZE + x] / 255;
      on[(offsetY + y) * GRID_WIDTH + offsetX + x] = random() < coverage * LOGO_DENSITY ? 1 : 0;
    }
  }

  return toSegments(on);
}

function toSegments(on) {
  const segments = [];
  for (let y = 0; y < GRID_HEIGHT; y++) {
    let x = 0;
    while (x < GRID_WIDTH) {
      if (!on[y * GRID_WIDTH + x]) {
        x++;
        continue;
      }
      let width = 1;
      while (width < MAX_RUN && x + width < GRID_WIDTH && on[y * GRID_WIDTH + x + width]) {
        width++;
      }
      segments.push([x, y, width]);
      x += width;
    }
  }
  return segments;
}

function padSegments(segments, count) {
  const repeats = new Uint16Array(segments.length).fill(1);
  for (let extra = segments.length; extra < count; extra++) {
    repeats[Math.floor(random() * segments.length)]++;
  }
  return segments.flatMap((segment, i) => Array(repeats[i]).fill(segment));
}

function noiseFrame(count) {
  return Array.from({ length: count }, () => [
    Math.floor(random() * (GRID_WIDTH - MAX_RUN)),
    Math.floor(random() * GRID_HEIGHT),
    1 + Math.floor(random() * MAX_RUN),
  ]);
}

function toPathData(segments) {
  return segments.map(([x, y, width]) => `M${x},${y}h${width}v1h-${width}Z`).join('');
}

function escapeXml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function infoLine(key, value, y, begin) {
  const dots = '.'.repeat(Math.max(4, 86 - key.length - value.length));
  return `<g opacity="0"><animate attributeName="opacity" from="0" to="1" dur="0.4s" begin="${begin.toFixed(2)}s" fill="freeze"/><animateTransform attributeName="transform" type="translate" values="-8 0;0 0" dur="0.4s" begin="${begin.toFixed(2)}s" fill="freeze"/><text x="470" y="${y}" font-size="14" textLength="655" lengthAdjust="spacingAndGlyphs" xml:space="preserve"><tspan fill="#22D3EE">${escapeXml(key)} </tspan><tspan fill="rgba(148,163,184,0.35)">${dots}</tspan><tspan fill="#F8FAFC" font-weight="600"> ${escapeXml(value)}</tspan></text></g>`;
}

function buildInfoPanel() {
  const lines = [];
  let y = 162;
  let begin = 0.9;

  for (const [key, value] of infoLines) {
    lines.push(infoLine(key, value, y, begin));
    y += 23;
    begin += 0.12;
  }

  y += 8;
  begin += 0.1;
  for (const [key, value] of coreLines) {
    lines.push(infoLine(key, value, y, begin));
    y += 23;
    begin += 0.12;
  }

  y += 8;
  begin += 0.1;
  lines.push(`<g opacity="0"><animate attributeName="opacity" from="0" to="1" dur="0.4s" begin="${begin.toFixed(2)}s" fill="freeze"/><text x="470" y="${y}" font-size="14" textLength="655" lengthAdjust="spacingAndGlyphs" xml:space="preserve"><tspan fill="#94A3B8">- Contact </tspan><tspan fill="rgba(148,163,184,0.35)">${'-'.repeat(69)}</tspan></text></g>`);
  y += 23;
  begin += 0.12;

  for (const [key, value] of contactLines) {
    lines.push(infoLine(key, value, y, begin));
    y += 23;
    begin += 0.12;
  }

  begin += 0.2;
  lines.push(`<g opacity="0"><animate attributeName="opacity" from="0" to="1" dur="0.5s" begin="${begin.toFixed(2)}s" fill="freeze"/>
<text x="470" y="${y + 8}" font-size="14" fill="#94A3B8">&#9656; More about me &amp; projects below in README &#8595; <tspan fill="#22D3EE">&#9608;<animate attributeName="fill-opacity" values="1;0;1" dur="1s" repeatCount="indefinite"/></tspan></text>
</g>`);

  return lines.join('\n');
}

function buildSvg(pathFrames, outline) {
  const badgeWidth = Math.round(email.length * 8.6 + 18);
  const keyTimes = '0;0.125;0.375;0.4583;0.625;0.7083;0.875;0.9583;1';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1180" height="610" viewBox="0 0 1180 610" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace" role="img" aria-label="Dennis Jayvee Patricio - profile.sh --live">
<defs>
<linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
<stop offset="0" stop-color="#7C3AED"><animate attributeName="stop-color" values="#7C3AED;#22D3EE;#10B981;#7C3AED" dur="10s" repeatCount="indefinite"/></stop>
<stop offset="0.5" stop-color="#22D3EE"><animate attributeName="stop-color" values="#22D3EE;#10B981;#7C3AED;#22D3EE" dur="10s" repeatCount="indefinite"/></stop>
<stop offset="1" stop-color="#10B981"><animate attributeName="stop-color" values="#10B981;#7C3AED;#22D3EE;#10B981" dur="10s" repeatCount="indefinite"/></stop>
</linearGradient>
<linearGradient id="panelGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0A101F"/><stop offset="1" stop-color="#0C1426"/></linearGradient>
<filter id="glow8" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="8"/></filter>
<filter id="glow3" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="3"/></filter>
<filter id="txtGlow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="0.9" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<clipPath id="winClip"><rect x="2" y="2" width="1176" height="606" rx="18"/></clipPath>
<clipPath id="visualMapClip"><rect x="36" y="84" width="400" height="492" rx="10"/></clipPath>
</defs>
<rect x="2" y="2" width="1176" height="606" rx="18" fill="#070B16"/>
<g clip-path="url(#winClip)">
<rect x="2" y="2" width="1176" height="606" fill="url(#panelGrad)"/>
<rect x="2" y="2" width="1176" height="46" fill="#0B1222"/>
<line x1="2" y1="48" x2="1178" y2="48" stroke="rgba(255,255,255,0.10)"/>
<circle cx="30" cy="25" r="5.5" fill="#ff5f56"/>
<circle cx="50" cy="25" r="5.5" fill="#ffbd2e"/>
<circle cx="70" cy="25" r="5.5" fill="#27c93f"/>
<text x="590" y="29" text-anchor="middle" font-size="12" fill="#94A3B8">${email} - % ./profile.sh --live</text>
<text x="38" y="74" font-size="10" letter-spacing="3" fill="#475569">VISUAL.MAP</text>
<rect x="36" y="84" width="400" height="492" rx="10" fill="none" stroke="#22D3EE" stroke-width="2" opacity="0.45" filter="url(#glow3)"/>
<rect x="36" y="84" width="400" height="492" rx="10" fill="#0A101F" stroke="rgba(34,211,238,0.35)"/>
<g clip-path="url(#visualMapClip)"><g transform="translate(36,84) scale(1.33333)"><path d="${pathFrames[0]}" fill="#A78BFA" shape-rendering="crispEdges"><animate attributeName="d" dur="24s" repeatCount="indefinite" keyTimes="${keyTimes}" values="${pathFrames.join(';')}"/></path></g></g>
<g clip-path="url(#visualMapClip)"><g transform="translate(36,84) scale(1.33333)"><path d="${outline}" fill="none" stroke="#A78BFA" stroke-width="1.3" stroke-linejoin="round" opacity="0"><animate attributeName="opacity" dur="24s" repeatCount="indefinite" keyTimes="0;0.125;0.375;0.4583;0.9583;1" values="0;0.9;0.9;0;0;0"/></path></g></g>
<path d="M 50 84 L 36 84 L 36 98" fill="none" stroke="#22D3EE" stroke-width="2" opacity="0.8"/>
<path d="M 422 84 L 436 84 L 436 98" fill="none" stroke="#22D3EE" stroke-width="2" opacity="0.8"/>
<path d="M 50 576 L 36 576 L 36 562" fill="none" stroke="#22D3EE" stroke-width="2" opacity="0.8"/>
<path d="M 422 576 L 436 576 L 436 562" fill="none" stroke="#22D3EE" stroke-width="2" opacity="0.8"/>
<text x="470" y="106" font-size="13" letter-spacing="2" fill="#22D3EE" filter="url(#txtGlow)">SYSTEM.INFO</text>
<line x1="566" y1="102" x2="1061" y2="102" stroke="rgba(255,255,255,0.10)"/>
<text x="1125" y="106" text-anchor="end" font-size="12" fill="#F87171" font-weight="700"><tspan>&#9679;</tspan> LIVE<animate attributeName="opacity" values="1;0.25;1" dur="1.6s" repeatCount="indefinite"/></text>
<g opacity="0"><animate attributeName="opacity" from="0" to="1" dur="0.5s" begin="0.6s" fill="freeze"/>
<rect x="470" y="122" width="${badgeWidth}" height="20" rx="4" fill="#4C1D95"/>
<text x="479" y="136" font-size="14" font-weight="700" fill="#E9D5FF">${email}</text>
<line x1="${470 + badgeWidth + 10}" y1="130" x2="1125" y2="130" stroke="rgba(255,255,255,0.10)"/>
</g>
${buildInfoPanel()}
</g>
<rect x="3" y="3" width="1174" height="604" rx="17" fill="none" stroke="url(#accent)" stroke-width="3" opacity="0.55" filter="url(#glow8)"/>
<rect x="3" y="3" width="1174" height="604" rx="17" fill="none" stroke="url(#accent)" stroke-width="1.6"/>
</svg>
`;
}
