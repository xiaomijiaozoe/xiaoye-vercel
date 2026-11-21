// Vercel Edge Runtime：扣子回答流式转发（NDJSON，每行一个 JSON）
// 前端 POST /api/chat-stream  { question }
// 返回：{"content":"..."} 多行 + 最后 {"done":true}
// 环境变量：COZE_TOKEN, COZE_BOT_ID

export const config = { runtime: 'edge' };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' }
    });
  }

  const TOKEN = process.env.COZE_TOKEN;
  const BOT_ID = process.env.COZE_BOT_ID;
  if (!TOKEN || !BOT_ID) {
    return new Response(JSON.stringify({ error: '缺少环境变量 COZE_TOKEN 或 COZE_BOT_ID' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' }
    });
  }

  let question = '';
  try {
    const body = await req.json();
    question = (body && body.question) || '';
  } catch (_) {}
  if (!question) {
    return new Response(JSON.stringify({ error: '缺少 question' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' }
    });
  }

  let upstream;
  try {
    upstream = await fetch('https://api.coze.cn/v3/chat', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bot_id: BOT_ID,
        user_id: 'plant_guest_001',
        stream: true,
        additional_messages: [{ role: 'user', content: question, content_type: 'text' }]
      })
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: '请求扣子失败：' + e.message }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' }
    });
  }
  if (!upstream.ok || !upstream.body) {
    return new Response(JSON.stringify({ error: '扣子接口 HTTP ' + upstream.status }), {
      status: 502, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' }
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = obj => controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();
      let buf = '', event = '';
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let idx;
          while ((idx = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, idx); buf = buf.slice(idx + 1);
            const l = line.trim();
            if (!l) continue;
            if (l.startsWith('event:')) { event = l.slice(6).trim(); continue; }
            if (!l.startsWith('data:') || event !== 'conversation.message.delta') continue;
            try {
              const obj = JSON.parse(l.slice(5).trim());
              if (obj.type === 'answer' && typeof obj.content === 'string' && obj.content) {
                send({ content: obj.content });
              }
            } catch (_) {}
          }
        }
        send({ done: true });
      } catch (e) {
        try { send({ error: e.message }); } catch (_) {}
      } finally {
        try { controller.close(); } catch (_) {}
      }
    }
  });

  return new Response(stream, {
    headers: {
      ...CORS,
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no'
    }
  });
}
