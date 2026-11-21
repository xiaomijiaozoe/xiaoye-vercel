// Vercel Serverless Function：火山引擎 TTS 中转
// 前端 POST /api/tts  { text }
// 返回 audio/mpeg 二进制
// 环境变量：VOLC_API_KEY, VOLC_RESOURCE_ID, VOLC_VOICE_TYPE

// Vercel 需要原始 body
module.exports.config = { api: { bodyParser: false } };

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  // ======== 需要配置的环境变量（Vercel 项目 Settings → Environment Variables） ========
  const API_KEY    = process.env.VOLC_API_KEY;       // 火山引擎 API Key
  const RESOURCE_ID= process.env.VOLC_RESOURCE_ID || 'seed-tts-2.0';        // 资源 ID
  const VOICE_TYPE = process.env.VOLC_VOICE_TYPE  || 'zh_female_vv_uranus_bigtts'; // 音色 ID
  // ====================================================================================

  if (!API_KEY) { res.status(500).json({ error: '缺少环境变量 VOLC_API_KEY' }); return; }

  try {
    // 读取原始 body
    const chunks = [];
    for await (const c of req) chunks.push(c);
    let text = '';
    try { text = (JSON.parse(Buffer.concat(chunks).toString()) || {}).text || ''; } catch (_) {}
    if (!text) { res.status(400).json({ error: '缺少 text' }); return; }
    // 单次文本上限，超长截断
    if (Buffer.byteLength(text, 'utf8') > 1000) text = text.slice(0, 330);

    const reqid = require('crypto').randomUUID();
    const payload = {
      user: { uid: 'plant_guest_001' },
      req_params: {
        text,
        speaker: VOICE_TYPE,
        audio_params: { format: 'mp3', sample_rate: 24000, speech_rate: 0 }
      }
    };
    const resp = await fetch('https://openspeech.bytedance.com/api/v3/tts/unidirectional', {
      method: 'POST',
      headers: {
        'X-Api-Key': API_KEY,
        'X-Api-Resource-Id': RESOURCE_ID,
        'X-Api-Request-Id': reqid,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const raw = await resp.text();

    // 拆出连续拼接的 JSON 对象，累加 base64 音频块
    const s = raw.trim(); const chunks2 = []; let i = 0;
    while (i < s.length) {
      let depth=0, inStr=false, esc=false, end=-1;
      for (let j=i;j<s.length;j++){
        const c=s[j];
        if(inStr){ if(esc)esc=false; else if(c==='\\')esc=true; else if(c==='"')inStr=false; }
        else { if(c==='"')inStr=true; else if(c==='{')depth++; else if(c==='}'){depth--; if(depth===0){end=j+1;break;}} }
      }
      if(end===-1) break;
      try{
        const o=JSON.parse(s.slice(i,end));
        if(o.code!==undefined && o.code!==0 && o.code!==20000000) throw new Error('火山错误 '+o.code+':'+(o.message||''));
        if(typeof o.data==='string') chunks2.push(Buffer.from(o.data,'base64'));
      }catch(err){ if(err.message.startsWith('火山错误')) throw err; }
      i=end; while(i<s.length && /\s/.test(s[i])) i++;
    }
    if(!chunks2.length) throw new Error('未获取到音频数据');

    res.setHeader('Content-Type','audio/mpeg');
    res.status(200).send(Buffer.concat(chunks2));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
