// Vercel Serverless Function：扣子对话中转
// 前端 POST /api/chat  { question }
// 环境变量：COZE_TOKEN, COZE_BOT_ID

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  // ======== 需要配置的环境变量（在 Vercel 项目 Settings → Environment Variables 添加） ========
  const TOKEN  = process.env.COZE_TOKEN;      // 扣子 PAT Token
  const BOT_ID = process.env.COZE_BOT_ID;     // 扣子 Bot ID
  // ==========================================================================================

  if (!TOKEN || !BOT_ID) {
    res.status(500).json({ error: '缺少环境变量 COZE_TOKEN 或 COZE_BOT_ID' });
    return;
  }

  try {
    const { question } = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    if (!question) { res.status(400).json({ error: '缺少 question' }); return; }

    const resp = await fetch('https://api.coze.cn/v3/chat', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bot_id: BOT_ID,
        user_id: 'plant_guest_001',
        stream: true,
        additional_messages: [{ role: 'user', content: question, content_type: 'text' }]
      })
    });
    if (!resp.ok) throw new Error('扣子接口 HTTP ' + resp.status);

    const text = await resp.text();
    let answer = '', event = '';
    for (const line of text.split('\n')) {
      if (line.startsWith('event:')) { event = line.slice(6).trim(); continue; }
      if (!line.startsWith('data:') || event !== 'conversation.message.delta') continue;
      try {
        const obj = JSON.parse(line.slice(5).trim());
        if (obj.type === 'answer' && typeof obj.content === 'string') answer += obj.content;
      } catch (_) {}
    }
    res.status(200).json({ answer: answer.trim() || '（这次没拿到回答，请再问一次）' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
