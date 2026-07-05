import { writeFileSync, mkdirSync } from "node:fs";
import { basename, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = join(__dirname, "..", "client", "public", "fonts");
const CSS_URL = "https://api.fontshare.com/v2/css?f[]=general-sans@300,400,500,600,700&f[]=cabinet-grotesk@300,500,700,800,900&display=swap";

mkdirSync(FONTS_DIR, { recursive: true });

const cssResponse = await fetch(CSS_URL);
const css = await cssResponse.text();

const fontFaceRegex = /@font-face\s*\{([^}]+)\}/g;
const urlRegex = /url\(['"]?([^'")\s]+)['"]?\)\s*format\(['"]woff2['"]\)/;
const propRegex = /font-(\w+)\s*:\s*([^;]+)/g;

const fontFaces = [];
let match;
while ((match = fontFaceRegex.exec(css)) !== null) {
  const block = match[1];
  const urlMatch = urlRegex.exec(block);
  if (!urlMatch) continue;

  const props = {};
  let propMatch;
  while ((propMatch = propRegex.exec(block)) !== null) {
    props[propMatch[1]] = propMatch[2].trim().replace(/['"]/g, "");
  }

  const url = urlMatch[1].startsWith("//") ? "https:" + urlMatch[1] : urlMatch[1];

  const parsedUrl = new URL(url);
  const FONT_DOMAINS = ["cdn.fontshare.com"];
  if (!FONT_DOMAINS.some((d) => parsedUrl.hostname === d || parsedUrl.hostname.endsWith("." + d))) {
    throw new Error(`Untrusted font URL domain: ${parsedUrl.hostname}`);
  }

  const rawFilename = basename(parsedUrl.pathname);
  if (!/^[\w.-]+\.woff2$/.test(rawFilename)) {
    throw new Error(`Invalid font filename: ${rawFilename}`);
  }
  const filename = rawFilename;
  fontFaces.push({ ...props, url, filename });
}

console.log(`Found ${fontFaces.length} font variants`);

for (const face of fontFaces) {
  const filepath = join(FONTS_DIR, face.filename);
  if (process.argv.includes("--download")) {
    const resp = await fetch(face.url);
    if (!resp.ok) throw new Error(`Failed to download ${face.url}: ${resp.status}`);
    const buffer = Buffer.from(await resp.arrayBuffer());
    if (buffer.length < 4 || buffer.toString("ascii", 0, 4) !== "wOFF") {
      throw new Error(`Downloaded file is not a valid woff2: ${face.filename}`);
    }
    writeFileSync(filepath, buffer);
    console.log(`  Downloaded ${face.filename} (${face["family"]} ${face.weight})`);
  }
}

const EXPECTED_FAMILIES = ["General Sans", "Cabinet Grotesk"];
const EXPECTED_WEIGHTS = ["300", "400", "500", "600", "700", "800", "900"];

for (const face of fontFaces) {
  if (!EXPECTED_FAMILIES.includes(face.family)) {
    throw new Error(`Unexpected font family: ${face.family}`);
  }
  if (!/^(normal|italic)$/.test(face.style)) {
    throw new Error(`Unexpected font style: ${face.style}`);
  }
  if (!EXPECTED_WEIGHTS.includes(face.weight)) {
    throw new Error(`Unexpected font weight: ${face.weight}`);
  }
}

const fontCss = fontFaces.map((face) => {
  const props = [
    `font-family: '${face.family}'`,
    `font-style: ${face.style}`,
    `font-weight: ${face.weight}`,
    "font-display: swap",
    `src: url('/fonts/${face.filename}') format('woff2')`,
  ];
  return `@font-face {\n  ${props.join(";\n  ")};\n}`;
}).join("\n\n");

writeFileSync(join(FONTS_DIR, "..", "fonts.css"), fontCss + "\n");
console.log(`Generated fonts.css with ${fontFaces.length} @font-face rules`);
