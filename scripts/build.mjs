/**
 * Build für clasp und lokale Vorschau.
 *
 *  dist/          → wird per `clasp push` nach Apps Script übertragen (rootDir in .clasp.json)
 *    Core.js        gebündelte Logik aus src/core + src/analytics (global `Tensio`)
 *    *.gs           Backend aus src/backend
 *    *.html         Frontend aus src/frontend
 *    appsscript.json
 *  dist-preview/  → index.html: eigenständige Vorschau mit fiktiven Demo-Daten
 */
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const preview = path.join(root, 'dist-preview');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

fs.rmSync(dist, { recursive: true, force: true });
fs.rmSync(preview, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
fs.mkdirSync(preview, { recursive: true });

const banner = `/* Tensio ${pkg.version} – generiert aus src/core und src/analytics. Nicht direkt bearbeiten. */`;
const result = await build({
  entryPoints: [path.join(root, 'src/core/index.js')],
  bundle: true,
  format: 'iife',
  globalName: 'Tensio',
  platform: 'neutral',
  target: 'es2019',
  write: false,
  banner: { js: banner },
  legalComments: 'none'
});
const core = result.outputFiles[0].text;
fs.writeFileSync(path.join(dist, 'Core.js'), core);

const copyDir = (from, ext) => {
  for (const f of fs.readdirSync(from)) {
    if (f.endsWith(ext)) fs.copyFileSync(path.join(from, f), path.join(dist, f));
  }
};
copyDir(path.join(root, 'src/backend'), '.gs');
// Frontend als EINE Datei: alle include()-Bausteine werden in Index.html eingefügt.
// Apps Script braucht dann nur Index.html (plus die .gs-Dateien und Core.js).
{
  const srcDir = path.join(root, 'src/frontend');
  const INC = /<\?!=\s*include\('([A-Za-z0-9_]+)'\);?\s*\?>/g;
  const inline = (name, depth = 0) => {
    if (depth > 5) throw new Error('Include-Tiefe überschritten');
    const file = path.join(srcDir, name + '.html');
    if (!fs.existsSync(file)) throw new Error('Include nicht gefunden: ' + name);
    return fs.readFileSync(file, 'utf8').replace(INC, (_, n) => inline(n, depth + 1));
  };
  const single = inline('Index');
  if (/<\?/.test(single)) throw new Error('Unaufgelöste Template-Tags in dist/Index.html');
  fs.writeFileSync(path.join(dist, 'Index.html'), single);
}
fs.copyFileSync(path.join(root, 'appsscript.json'), path.join(dist, 'appsscript.json'));

// ---------- Vorschau: Templates auflösen wie HtmlService ----------
const frontend = path.join(root, 'src/frontend');
const INCLUDE = /<\?!=\s*include\('([A-Za-z0-9_]+)'\);?\s*\?>/g;
const resolve = (name, depth = 0) => {
  if (depth > 5) throw new Error('Include-Tiefe überschritten');
  const file = path.join(frontend, name + '.html');
  if (!fs.existsSync(file)) throw new Error('Include nicht gefunden: ' + name);
  return fs.readFileSync(file, 'utf8').replace(INCLUDE, (_, n) => resolve(n, depth + 1));
};
let html = fs.readFileSync(path.join(frontend, 'Index.html'), 'utf8');
const previewScripts =
  `<script>\n${core}\n</script>\n` +
  `<script>\n${fs.readFileSync(path.join(root, 'src/preview/PreviewApi.js'), 'utf8')}\n</script>\n`;
html = html.replace("<?!= include('Scripts'); ?>", previewScripts + "<?!= include('Scripts'); ?>");
html = html.replace(INCLUDE, (_, n) => resolve(n));
html = html.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">');
if (/<\?/.test(html)) throw new Error('Unaufgelöste Template-Tags in der Vorschau');
fs.writeFileSync(path.join(preview, 'index.html'), html);

// ---------- GitHub Pages: statische Seite, Backend per fetch ----------
{
  const pages = path.join(root, 'dist-pages');
  fs.rmSync(pages, { recursive: true, force: true });
  fs.mkdirSync(pages, { recursive: true });
  let page = fs.readFileSync(path.join(dist, 'Index.html'), 'utf8');
  page = page.replace('</head>', '  <script src="config.js"></script>\n</head>');
  fs.writeFileSync(path.join(pages, 'index.html'), page);
  fs.copyFileSync(path.join(root, 'pages/config.js'), path.join(pages, 'config.js'));
  fs.writeFileSync(path.join(pages, '.nojekyll'), '');
}

const files = fs.readdirSync(dist);
console.log(`dist/: ${files.length} Dateien (${files.join(', ')})`);
console.log(`dist-preview/index.html: ${(html.length / 1024).toFixed(0)} KB`);
