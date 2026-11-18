// A tiny local forwarding proxy for manual browser testing only (not used by the app's own
// scrapers, which already authenticate programmatically via page.authenticate()).
//
// Chrome refuses to let an extension or the command line supply proxy credentials, so it always
// shows a native "Sign in" popup for an authenticated upstream proxy - which failed to auto-fill
// here (extension blocked, clipboard not synced over RDP). This sidesteps all of that: Chrome talks
// to this LOCAL, unauthenticated proxy, which transparently adds the real Proxy-Authorization header
// before forwarding to the real (authenticated) upstream proxy. Chrome never sees a login prompt.
const net = require('net');
const http = require('http');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '..', 'config', 'config.env') });

const LOCAL_PORT = 8899;
const proxyUrl = process.env.HTTP_PROXY_URL;
if (!proxyUrl) {
  console.error('HTTP_PROXY_URL is not set - nothing to forward to.');
  process.exit(1);
}
const upstream = new URL(proxyUrl);
const authHeader = 'Basic ' + Buffer.from(`${decodeURIComponent(upstream.username)}:${decodeURIComponent(upstream.password)}`).toString('base64');

const server = http.createServer((req, res) => {
  // Plain HTTP (non-CONNECT) requests - forward with auth added.
  const options = {
    hostname: upstream.hostname,
    port: upstream.port,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, 'Proxy-Authorization': authHeader }
  };
  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });
  req.pipe(proxyReq);
  proxyReq.on('error', (e) => { res.writeHead(502); res.end('Proxy error: ' + e.message); });
});

server.on('connect', (req, clientSocket, head) => {
  // HTTPS (CONNECT tunnel) - this is what Chrome uses for almost everything.
  const upstreamSocket = net.connect(upstream.port, upstream.hostname, () => {
    upstreamSocket.write(
      `CONNECT ${req.url} HTTP/1.1\r\n` +
      `Host: ${req.url}\r\n` +
      `Proxy-Authorization: ${authHeader}\r\n` +
      `Connection: Keep-Alive\r\n\r\n`
    );
    upstreamSocket.once('data', (data) => {
      const statusLine = data.toString('utf8', 0, data.indexOf('\r\n'));
      if (/200/.test(statusLine)) {
        clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        upstreamSocket.pipe(clientSocket);
        clientSocket.pipe(upstreamSocket);
      } else {
        clientSocket.end(`HTTP/1.1 502 Bad Gateway\r\n\r\nUpstream proxy refused: ${statusLine}\r\n`);
      }
    });
  });
  upstreamSocket.on('error', (e) => clientSocket.end(`HTTP/1.1 502 Bad Gateway\r\n\r\n${e.message}`));
  clientSocket.on('error', () => upstreamSocket.destroy());
});

server.listen(LOCAL_PORT, '127.0.0.1', () => {
  console.log(`Local auth-forwarding proxy listening on 127.0.0.1:${LOCAL_PORT} -> ${upstream.hostname}:${upstream.port}`);
});
