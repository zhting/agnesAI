const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

const server = http.createServer((req, res) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);

  // 提供 index.html 页面
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    const html = fs.readFileSync(path.join(__dirname, 'index.html'));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  // 获取本地保存的 API Key
  if (req.method === 'GET' && req.url === '/api/key') {
    let apiKey = '';
    const keyPath = path.join(__dirname, 'key.txt');
    if (fs.existsSync(keyPath)) {
      apiKey = fs.readFileSync(keyPath, 'utf8').trim();
    }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ apiKey }));
    return;
  }

  // 保存 API Key 到本地文件
  if (req.method === 'POST' && req.url === '/api/key') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const apiKey = (data.apiKey || '').trim();
        const keyPath = path.join(__dirname, 'key.txt');
        fs.writeFileSync(keyPath, apiKey, 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 读取本地配置（默认模型、模型列表、启用状态等）
  if (req.method === 'GET' && req.url === '/api/config') {
    const configPath = path.join(__dirname, 'config.json');
    let config = {};
    if (fs.existsSync(configPath)) {
      try {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      } catch (e) {
        console.warn('config.json 解析失败，使用空配置:', e.message);
      }
    }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(config));
    return;
  }

  // 写入本地配置（整体覆盖）
  if (req.method === 'POST' && req.url === '/api/config') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const configPath = path.join(__dirname, 'config.json');
        fs.writeFileSync(configPath, JSON.stringify(data, null, 2), 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 视频代理中转服务（解决国内 storage.googleapis.com 被墙无法加载视频的问题）
  if (req.method === 'GET' && req.url.startsWith('/video-proxy')) {
    try {
      const urlObj = new URL(req.url, `http://${req.headers.host}`);
      const targetUrl = urlObj.searchParams.get('url');
      if (!targetUrl) {
        res.writeHead(400);
        res.end('Missing url parameter');
        return;
      }

      const parsedTarget = new URL(targetUrl);
      const proxyReq = https.request({
        hostname: parsedTarget.hostname,
        port: 443,
        path: parsedTarget.pathname + parsedTarget.search,
        method: 'GET',
      }, (upstream) => {
        res.writeHead(upstream.statusCode, upstream.headers);
        upstream.pipe(res);
      });

      proxyReq.on('error', (err) => {
        console.error('视频中转失败:', err.message);
        if (!res.headersSent) {
          res.writeHead(502);
          res.end('Failed to proxy video');
        }
      });

      proxyReq.end();
    } catch (err) {
      res.writeHead(400);
      res.end('Invalid url');
    }
    return;
  }

  // 代理转发 /v1/* → https://apihub.agnes-ai.com/v1/*
  if (req.url.startsWith('/v1/')) {
    let apiKey = req.headers['x-api-key'] || '';
    // 如果前端没有在 header 里传 key，则尝试从本地文件读取
    if (!apiKey) {
      const keyPath = path.join(__dirname, 'key.txt');
      if (fs.existsSync(keyPath)) {
        apiKey = fs.readFileSync(keyPath, 'utf8').trim();
      }
    }

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      // 剥离 query 参数，防止官方 API 路由或微服务无法兼容 ?_t=... 导致数据返回异常
      const cleanPath = req.url.split('?')[0];

      const options = {
        hostname: 'apihub.agnes-ai.com',
        port: 443,
        path: cleanPath,
        method: req.method,
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      };
      if (body) options.headers['Content-Length'] = Buffer.byteLength(body);

      const proxy = https.request(options, (upstream) => {
        console.log(`[${new Date().toLocaleTimeString()}] 上游接口响应状态码: ${upstream.statusCode}`);

        const upstreamCT = (upstream.headers['content-type'] || '').toLowerCase();
        const isStream = upstreamCT.includes('text/event-stream');

        // 流式响应（SSE）：直接透传，不收集 body，否则前端无法增量收到 token
        if (isStream && upstream.statusCode >= 200 && upstream.statusCode < 300) {
          res.writeHead(upstream.statusCode, {
            'Content-Type': upstream.headers['content-type'],
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
          });
          upstream.pipe(res);
          return;
        }

        let respBody = '';
        upstream.on('data', chunk => { respBody += chunk; });
        upstream.on('end', () => {
          console.log(`[${new Date().toLocaleTimeString()}] 上游接口返回数据:`, respBody.slice(0, 500));
        });

        // 上游非 2xx 时，统一包装为 JSON 错误返回
        if (upstream.statusCode < 200 || upstream.statusCode >= 300) {
          let parsed;
          try {
            parsed = JSON.parse(respBody);
          } catch {
            parsed = null;
          }
          res.writeHead(upstream.statusCode, {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          });
          if (upstream.statusCode === 401) {
            res.end(JSON.stringify({ error: { message: 'API Key 无效或已过期，请检查并重新输入。' } }));
          } else if (parsed && parsed.error) {
            // 嵌套错误展开
            const msg = parsed.error.message || parsed.error;
            res.end(JSON.stringify({ error: { message: `上游错误: ${msg}` } }));
          } else if (parsed && parsed.message) {
            res.end(JSON.stringify({ error: { message: `上游错误: ${parsed.message}` } }));
          } else {
            const summary = respBody ? respBody.slice(0, 300) : `(空响应)`;
            res.end(JSON.stringify({ error: { message: `上游返回 HTTP ${upstream.statusCode}: ${summary}` } }));
          }
          return;
        }

        res.writeHead(upstream.statusCode, {
          'Content-Type': upstream.headers['content-type'] || 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        });

        upstream.pipe(res);
      });

      proxy.on('error', (err) => {
        console.error('代理请求失败:', err.message);
        if (res.headersSent) {
          console.warn('响应头已发送，仅销毁客户端连接。');
          res.destroy();
          return;
        }
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: `上游请求失败: ${err.message}` } }));
      });

      if (body) proxy.write(body);
      proxy.end();
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n  Agnes Video V2.0 已启动`);
  console.log(`  请在浏览器打开: http://localhost:${PORT}\n`);
});
