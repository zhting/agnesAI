const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

// ── 上游连接复用 ──────────────────────────────────────────────────
// 默认 https.globalAgent 每次请求都会新建 socket（TLS 握手 ~150-400 ms）。
// 用自定义 Agent 开启 keepAlive，多轮对话/轮询能复用同一条连接，省下握手时间。
const httpsKeepAliveAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 30 * 1000,  // 30s 内复用 socket
  maxSockets: 32,             // 单主机最大并发
  scheduling: 'lifo',         // 偏好最近使用的连接（命中缓存几率更高）
});
const httpKeepAliveAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 30 * 1000,
  maxSockets: 32,
  scheduling: 'lifo',
});

// 读写环境配置文件的辅助函数
function getApiKeyFromEnv() {
  const envPath = path.join(__dirname, '.env');
  let apiKey = '';
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    const match = content.match(/AGNES_API_KEY\s*=\s*([^\r\n]+)/);
    if (match) {
      apiKey = match[1].trim();
    }
  }
  // 兼容旧版 key.txt 并迁移
  if (!apiKey) {
    const keyPath = path.join(__dirname, 'key.txt');
    if (fs.existsSync(keyPath)) {
      apiKey = fs.readFileSync(keyPath, 'utf8').trim();
      if (apiKey) {
        saveApiKeyToEnv(apiKey);
      }
    }
  }
  return apiKey;
}

function saveApiKeyToEnv(apiKey) {
  const envPath = path.join(__dirname, '.env');
  let content = '';
  if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, 'utf8');
  }
  
  if (content.includes('AGNES_API_KEY=')) {
    content = content.replace(/AGNES_API_KEY\s*=\s*[^\r\n]*/, `AGNES_API_KEY=${apiKey}`);
  } else {
    content += (content.endsWith('\n') || content === '' ? '' : '\n') + `AGNES_API_KEY=${apiKey}\n`;
  }
  fs.writeFileSync(envPath, content, 'utf8');

  // 删除 key.txt
  const keyPath = path.join(__dirname, 'key.txt');
  if (fs.existsSync(keyPath)) {
    try {
      fs.unlinkSync(keyPath);
    } catch (e) {
      console.error('删除 key.txt 失败:', e.message);
    }
  }
}

// 创建保存历史媒体的本地目录
const OUTPUTS_DIR = path.join(__dirname, 'outputs');
if (!fs.existsSync(OUTPUTS_DIR)) {
  fs.mkdirSync(OUTPUTS_DIR);
}

const server = http.createServer((req, res) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);

  // 静态提供 outputs 目录中的生成结果
  if (req.method === 'GET' && req.url.startsWith('/outputs/')) {
    const safeFilename = path.basename(req.url);
    const filePath = path.join(OUTPUTS_DIR, safeFilename);
    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath).toLowerCase();
      let contentType = 'application/octet-stream';
      if (ext === '.mp4') contentType = 'video/mp4';
      if (ext === '.png') contentType = 'image/png';
      if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
      
      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
    return;
  }

  // 提供 index.html 页面
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    const html = fs.readFileSync(path.join(__dirname, 'index.html'));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  // 获取本地保存的 API Key
  if (req.method === 'GET' && req.url === '/api/key') {
    const apiKey = getApiKeyFromEnv();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ apiKey }));
    return;
  }

  // 保存 API Key 到本地环境配置文件
  if (req.method === 'POST' && req.url === '/api/key') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const apiKey = (data.apiKey || '').trim();
        saveApiKeyToEnv(apiKey);
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

  // 获取历史记录列表
  if (req.method === 'GET' && req.url.startsWith('/api/history')) {
    const historyPath = path.join(__dirname, 'history.json');
    let history = [];
    if (fs.existsSync(historyPath)) {
      try {
        history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
      } catch (e) {
        console.warn('history.json 解析失败:', e.message);
      }
    } else {
      // 首次加载，在本地初始化默认记录
      history = [
        { id: 'h_1', title: '宇航员 · 红色星球', kind: 'video', ar: '16:9', tone: 268, prompt: 'A young astronaut walking across a red desert planet, dust blowing in the wind, slow cinematic tracking shot, dramatic sunset lighting, realistic sci-fi style', model: 'agnes-video-v2.0', width: 1152, height: 768, url: '' },
        { id: 'h_2', title: '赛博女神肖像', kind: 'image', ar: '1:1', tone: 320, prompt: 'A stunning portrait of a cybernetic goddess, intricate neon makeup, glowing neural pathways, cyberpunk city background, hyperrealistic, octane render, 8k', model: 'agnes-image-2.1-flash', width: 1024, height: 1024, url: '' },
        { id: 'h_3', title: '雨夜霓虹街道', kind: 'video', ar: '9:16', tone: 210, prompt: 'A rainy night in Tokyo, neon street signs reflecting on wet asphalt, people walking with umbrellas, cinematic atmosphere, slow tracking shot', model: 'agnes-video-v2.0', width: 720, height: 1280, url: '' },
        { id: 'h_4', title: '极简产品主图', kind: 'image', ar: '1:1', tone: 150, prompt: 'Minimalist product shot of a luxury perfume bottle on a concrete pedestal, soft studio lighting, clean shadows, elegant composition', model: 'agnes-image-2.1-flash', width: 1024, height: 1024, url: '' }
      ];
      try {
        fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), 'utf8');
      } catch (e) {
        console.error('初始化 history.json 失败:', e.message);
      }
    }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(history));
    return;
  }

  // 保存历史记录（及媒体内容）
  if (req.method === 'POST' && req.url.startsWith('/api/history')) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const item = JSON.parse(body);
        const kind = item.kind || 'image';
        const rawUrl = item.url || '';
        
        const ext = kind === 'video' ? 'mp4' : 'png';
        const filename = `${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`;
        const destPath = path.join(OUTPUTS_DIR, filename);
        
        let localUrl = rawUrl;
        let downloaded = false;
        
        if (rawUrl) {
          if (rawUrl.startsWith('data:')) {
            const base64Data = rawUrl.replace(/^data:image\/\w+;base64,/, "");
            const buf = Buffer.from(base64Data, 'base64');
            fs.writeFileSync(destPath, buf);
            localUrl = `/outputs/${filename}`;
            downloaded = true;
          } else {
            // 下载远程资源
            try {
              let realUrl = rawUrl;
              if (rawUrl.startsWith('/video-proxy?url=')) {
                const u = new URL(rawUrl, `http://${req.headers.host}`);
                realUrl = u.searchParams.get('url');
              }
              await new Promise((resolve, reject) => {
                const client = realUrl.startsWith('https') ? https : http;
                client.get(realUrl, (response) => {
                  if (response.statusCode !== 200) {
                    reject(new Error(`Status ${response.statusCode}`));
                    return;
                  }
                  const file = fs.createWriteStream(destPath);
                  response.pipe(file);
                  file.on('finish', () => {
                    file.close(resolve);
                  });
                }).on('error', (err) => {
                  reject(err);
                });
              });
              localUrl = `/outputs/${filename}`;
              downloaded = true;
            } catch (err) {
              console.error('下载历史媒体失败，降级使用原 URL:', err.message);
            }
          }
        }
        
        const historyItem = {
          id: item.id || ('h_' + Date.now()),
          title: item.title,
          kind: item.kind,
          ar: item.ar,
          tone: item.tone || 292,
          prompt: item.prompt,
          model: item.model,
          width: item.width,
          height: item.height,
          url: localUrl,
          filename: downloaded ? filename : null
        };
        
        const historyPath = path.join(__dirname, 'history.json');
        let history = [];
        if (fs.existsSync(historyPath)) {
          try {
            history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
          } catch (e) {}
        }
        
        history.unshift(historyItem);
        
        // 限制最多保存 100 条
        if (history.length > 100) {
          const removed = history.pop();
          if (removed && removed.filename) {
            const remPath = path.join(OUTPUTS_DIR, removed.filename);
            if (fs.existsSync(remPath)) {
              fs.unlinkSync(remPath);
            }
          }
        }
        
        fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), 'utf8');
        
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, item: historyItem }));
      } catch (err) {
        console.error('保存历史失败:', err);
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 删除历史记录项
  if (req.method === 'DELETE' && req.url.startsWith('/api/history')) {
    try {
      const urlObj = new URL(req.url, `http://${req.headers.host}`);
      const id = urlObj.searchParams.get('id');
      if (!id) {
        res.writeHead(400);
        res.end('Missing id');
        return;
      }
      
      const historyPath = path.join(__dirname, 'history.json');
      let history = [];
      if (fs.existsSync(historyPath)) {
        try {
          history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
        } catch (e) {}
      }
      
      const itemToDelete = history.find(h => h.id === id);
      if (itemToDelete) {
        // 删除磁盘上的本地媒体文件
        if (itemToDelete.filename) {
          const remPath = path.join(OUTPUTS_DIR, itemToDelete.filename);
          if (fs.existsSync(remPath)) {
            try {
              fs.unlinkSync(remPath);
            } catch (err) {
              console.error('物理文件删除失败:', err.message);
            }
          }
        }
        
        // 更新 JSON
        history = history.filter(h => h.id !== id);
        fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), 'utf8');
      }
      
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: err.message }));
    }
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
      
      const proxyHeaders = {
        'Host': parsedTarget.hostname,
        'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      };
      if (req.headers['range']) {
        proxyHeaders['Range'] = req.headers['range'];
      }
      if (req.headers['accept']) {
        proxyHeaders['Accept'] = req.headers['accept'];
      }

      const proxyReq = https.request({
        hostname: parsedTarget.hostname,
        port: 443,
        path: parsedTarget.pathname + parsedTarget.search,
        method: 'GET',
        headers: proxyHeaders,
        timeout: 20000, // 20秒超时限制
        agent: httpsKeepAliveAgent,
      }, (upstream) => {
        res.writeHead(upstream.statusCode, upstream.headers);
        upstream.pipe(res);
      });

      proxyReq.on('timeout', () => {
        proxyReq.destroy(new Error('Connection timeout to upstream storage'));
      });

      proxyReq.on('error', (err) => {
        console.error(`视频中转失败 [URL: ${targetUrl}]:`, err.message);
        if (!res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end(`Failed to proxy video: ${err.message}`);
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
    // 如果前端没有在 header 里传 key，则尝试从本地环境配置文件读取
    if (!apiKey) {
      apiKey = getApiKeyFromEnv();
    }

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      // 剥离 query 参数，防止官方 API 路由或微服务无法兼容 ?_t=... 导致数据返回异常
      const cleanPath = req.url.split('?')[0];

      // 动态读取 config.json 中的自定义 baseUrl
      let targetUrlStr = 'https://apihub.agnes-ai.com/v1';
      const configPath = path.join(__dirname, 'config.json');
      if (fs.existsSync(configPath)) {
        try {
          const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          if (config.baseUrl) {
            targetUrlStr = config.baseUrl;
          }
        } catch (e) {
          console.warn('读取 config.json 中的 baseUrl 失败:', e.message);
        }
      }

      let targetUrl;
      try {
        targetUrl = new URL(targetUrlStr);
      } catch (err) {
        targetUrl = new URL('https://apihub.agnes-ai.com/v1');
      }

      let upstreamPath = cleanPath;
      const configPathName = targetUrl.pathname.replace(/\/$/, '');
      if (configPathName && configPathName !== '/v1') {
        upstreamPath = configPathName + cleanPath.replace(/^\/v1/, '');
      }

      const options = {
        hostname: targetUrl.hostname,
        port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
        path: upstreamPath,
        method: req.method,
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      };
      const bodyByteLen = body ? Buffer.byteLength(body) : 0;
      if (body) options.headers['Content-Length'] = bodyByteLen;

      // 打印转发请求摘要，便于排查 413/503 等与请求体大小相关的问题
      if (req.method === 'POST' && bodyByteLen > 0) {
        const sizeKB = (bodyByteLen / 1024).toFixed(1);
        const sizeMB = (bodyByteLen / 1024 / 1024).toFixed(2);
        console.log(`[${new Date().toLocaleTimeString()}] → 上游 ${req.method} ${upstreamPath} · 请求体 ${sizeKB} KB (${sizeMB} MB)`);
        // 大体积请求额外提示：base64 图片很容易超出上游网关默认限制
        if (bodyByteLen > 4 * 1024 * 1024) {
          console.warn(`  ⚠ 请求体超过 4 MB，可能触发上游网关的 body size 限制（常见返回 503/413/空响应）`);
        }
      }

      const client = targetUrl.protocol === 'https:' ? https : http;
      // 复用 TLS 连接（多轮聊天/视频轮询可省下握手时间）
      options.agent = targetUrl.protocol === 'https:' ? httpsKeepAliveAgent : httpKeepAliveAgent;

      // ── 上游耗时打点 ──
      // 对所有 /v1/* 请求都打点，让用户一眼看出瓶颈在「连接」「上游处理」还是「下游传输」。
      // 对 /v1/chat/completions 还会额外计算「首字节延迟 TTFB」与「首 chunk 延迟 TTFT」。
      const isChatCompletion = upstreamPath.includes('/chat/completions');
      const t0 = Date.now();
      let tSocketConnect = null;
      let tFirstByte = null;
      let tFirstChunk = null;
      let socketReused = false;

      const proxy = client.request(options, (upstream) => {
        tFirstByte = Date.now();
        const ttfbMs = tFirstByte - t0;
        const connMs = tSocketConnect != null ? (tSocketConnect - t0) : null;
        const reuseTag = socketReused ? '(socket 复用)' : '(新建连接)';
        console.log(
          `[${new Date().toLocaleTimeString()}] ← 上游 ${targetUrl.hostname} 响应 HTTP ${upstream.statusCode} · ` +
          `TTFB ${ttfbMs}ms · 连接 ${connMs != null ? connMs + 'ms' : 'N/A'} ${reuseTag}`
        );

        const upstreamCT = (upstream.headers['content-type'] || '').toLowerCase();
        const isStream = upstreamCT.includes('text/event-stream');

        // 在 'data' 首次到来时记录首 chunk 时刻（TTFT）。
        // 这个监听器只用来打点，不消费 chunk —— upstream.pipe(res) 仍会拿到完整数据流。
        const firstChunkListener = () => {
          if (tFirstChunk == null) {
            tFirstChunk = Date.now();
            const ttftMs = tFirstChunk - t0;
            const headerToChunkMs = tFirstChunk - tFirstByte;
            if (isChatCompletion) {
              console.log(
                `  ⏱ 聊天 TTFT ${ttftMs}ms (header→chunk ${headerToChunkMs}ms)` +
                (isStream ? ' · 流式' : ' · 非流式')
              );
            }
          }
        };
        upstream.once('data', firstChunkListener);

        // 流结束时打印整体耗时（流式 = 全部 token 收完；非流式 = 全部 body 收完）
        upstream.once('end', () => {
          const totalMs = Date.now() - t0;
          if (isChatCompletion || isStream) {
            const ttft = tFirstChunk != null ? (tFirstChunk - t0) : null;
            const gen = tFirstChunk != null ? (Date.now() - tFirstChunk) : null;
            console.log(
              `  ⏱ 上游总耗时 ${totalMs}ms` +
              (ttft != null ? ` · TTFT ${ttft}ms · 生成阶段 ${gen}ms` : '')
            );
          }
        });

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

        // 非 2xx 错误响应：必须等 body 全部收完再回，否则永远只看到 `(空响应)`
        if (upstream.statusCode < 200 || upstream.statusCode >= 300) {
          upstream.on('end', () => {
            console.log(`[${new Date().toLocaleTimeString()}] 上游接口返回数据:`, respBody.slice(0, 500));
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
              const msg = parsed.error.message || parsed.error;
              res.end(JSON.stringify({ error: { message: `上游错误: ${msg}` } }));
            } else if (parsed && parsed.message) {
              res.end(JSON.stringify({ error: { message: `上游错误: ${parsed.message}` } }));
            } else {
              // 空响应 + 503/413 大概率是上游网关因请求体过大或当下繁忙而中断
              const isEmpty = !respBody;
              const isOverloaded = upstream.statusCode === 503 || upstream.statusCode === 413 || upstream.statusCode === 502;
              let summary = respBody ? respBody.slice(0, 300) : `(空响应)`;
              if (isEmpty && isOverloaded && bodyByteLen > 1024 * 1024) {
                const sizeMB = (bodyByteLen / 1024 / 1024).toFixed(2);
                summary = `(空响应，请求体 ${sizeMB} MB) — 上游网关可能因请求体过大而中断，建议改用图片 URL 或更小尺寸的参考图`;
              } else if (isEmpty && isOverloaded) {
                summary = `(空响应) — 上游服务暂时繁忙，稍后将自动重试`;
              }
              res.end(JSON.stringify({ error: { message: `上游返回 HTTP ${upstream.statusCode}: ${summary}` } }));
            }
          });
          return;
        }

        // 2xx 正常响应：日志记录后直接透传
        upstream.on('end', () => {
          console.log(`[${new Date().toLocaleTimeString()}] 上游接口返回数据:`, respBody.slice(0, 500));
        });

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
        try {
          fs.writeFileSync(path.join(OUTPUTS_DIR, 'error.log'), `${new Date().toISOString()} [Proxy Error] ${err.stack}\n`, { flag: 'a' });
        } catch (e) {}
        if (res.headersSent) {
          console.warn('响应头已发送，仅销毁客户端连接。');
          res.destroy();
          return;
        }
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: `上游请求失败: ${err.message}` } }));
      });

      // 记录 socket 连接时刻，用于区分「连接耗时」和「上游处理耗时」
      proxy.on('socket', (socket) => {
        // 如果 socket 已建立连接（来自 keepAlive 池），直接打点；否则等 'connect' 事件
        if (socket.connecting === false || socket.writable) {
          tSocketConnect = Date.now();
          socketReused = true;
        } else {
          socket.once('connect', () => {
            tSocketConnect = Date.now();
            socketReused = false;
          });
        }
      });

      if (body) proxy.write(body);
      proxy.end();
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n[提示] 端口 ${PORT} 已被占用，服务器似乎已经在运行中。`);
    console.error(`请直接在浏览器中打开: http://localhost:${PORT}`);
    console.error(`如果需要重新启动，请先关闭正在运行的终端或杀死占用该端口的 Node 进程。\n`);
    process.exit(1);
  } else {
    console.error('服务器启动失败:', err);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n  Agnes Video V2.0 已启动`);
  console.log(`  请在浏览器打开: http://localhost:${PORT}\n`);
});
