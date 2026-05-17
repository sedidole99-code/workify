// Workify — tiny zero-dependency static + JSON store server.
// Run: node server.js   (then open http://localhost:13001)
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.env.PORT || '13001', 10);
const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, 'data.json');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function sendJson(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(typeof obj === 'string' ? obj : JSON.stringify(obj));
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url === '/api/data' && req.method === 'GET') {
      const text = fs.existsSync(DATA_FILE) ? fs.readFileSync(DATA_FILE, 'utf8') : '';
      return sendJson(res, 200, text.trim() || '{}');
    }
    if (req.url === '/api/data' && req.method === 'PUT') {
      const body = await readBody(req);
      try { JSON.parse(body); } catch { return sendJson(res, 400, { error: 'invalid JSON' }); }
      fs.writeFileSync(DATA_FILE, body);
      res.writeHead(204);
      return res.end();
    }

    // Static
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath === '/' || urlPath === '') urlPath = '/index.html';
    const filePath = path.normalize(path.join(ROOT, urlPath));
    if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }
    if (path.basename(filePath) === 'data.json') { res.writeHead(403); return res.end('Forbidden'); }
    fs.readFile(filePath, (err, data) => {
      if (err) { res.writeHead(404); return res.end('Not found'); }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(data);
    });
  } catch (err) {
    res.writeHead(500);
    res.end(String(err && err.message || err));
  }
});

server.listen(PORT, () => {
  console.log(`Workify running at http://localhost:${PORT}`);
  console.log(`Data file: ${DATA_FILE}`);
});
