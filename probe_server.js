// 测试 9:16 / 16:9 比例上游是否接受
// 走本地代理 → apihub.agnes-ai.com（使用 key.txt 中保存的 key）
const http = require('http');

function call(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      host: '127.0.0.1', port: 3000, path,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      timeout: 60000,
    }, r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => resolve({ status: r.statusCode, body: d }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout 60s')); });
    req.write(data);
    req.end();
  });
}

(async () => {
  const cases = [
    { label: '图像 9:16 HD (720x1280)',  path: '/v1/images/generations',
      body: { model: 'agnes-image-2.1-flash', prompt: 'a vertical poster of a cyberpunk skyscraper at night, neon lights, ultra detailed', size: '720x1280', width: 720, height: 1280, n: 1 } },
    { label: '图像 16:9 HD (1280x720)',  path: '/v1/images/generations',
      body: { model: 'agnes-image-2.1-flash', prompt: 'a wide cinematic landscape, mountains and lake at sunrise', size: '1280x720', width: 1280, height: 720, n: 1 } },
    { label: '视频 9:16 (720x1280) 仅提交',  path: '/v1/videos',
      body: { model: 'agnes-video-v2.0', prompt: 'a vertical short of a dancer moving slowly', width: 720, height: 1280, num_frames: 81, frame_rate: 24 } },
    { label: '视频 16:9 (1280x720) 仅提交',  path: '/v1/videos',
      body: { model: 'agnes-video-v2.0', prompt: 'a cinematic horizon shot of a beach', width: 1280, height: 720, num_frames: 81, frame_rate: 24 } },
  ];

  for (const c of cases) {
    console.log('───────────────', c.label, '───────────────');
    try {
      const r = await call(c.path, c.body);
      console.log('HTTP', r.status);
      console.log('Body:', r.body.slice(0, 800));
    } catch (e) {
      console.log('ERR:', e.message);
    }
    console.log();
  }
})();
