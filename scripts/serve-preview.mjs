/** Minimaler Webserver für die Vorschau: http://localhost:8080 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist-preview/index.html');
const port = Number(process.env.PORT) || 8080;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  fs.createReadStream(file).pipe(res);
}).listen(port, () => console.log(`Vorschau: http://localhost:${port}`));
