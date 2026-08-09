import { Readable } from 'node:stream';

const ALLOWED = ['claude-sonnet-5', 'claude-opus-5', 'claude-haiku-4-5-20251001'];

export default async function handler(req, res){
  if(req.method !== 'POST') return res.status(405).json({error:{message:'POST only'}});
  const key = process.env.ANTHROPIC_API_KEY;
  if(!key) return res.status(500).json({error:{message:'Server par ANTHROPIC_API_KEY set nahi hai — Vercel Settings → Environment Variables mein add karke redeploy karo.'}});
  try{
    const body = (typeof req.body === 'object' && req.body) ? req.body : JSON.parse(req.body || '{}');
    const wantStream = body.stream === true;
    const payload = {
      model: ALLOWED.includes(body.model) ? body.model : 'claude-sonnet-5',
      max_tokens: Math.min(body.max_tokens || 8000, 16000),
      system: body.system,
      messages: body.messages
    };
    if(wantStream) payload.stream = true;
    const call = m => fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json'},
      body: JSON.stringify({...payload, model: m})
    });
    let r = await call(payload.model);
    if(!r.ok){
      let data = await r.json().catch(() => ({}));
      if(payload.model !== 'claude-sonnet-5' && /model/i.test((data.error && data.error.message) || '')){
        r = await call('claude-sonnet-5');
        if(!r.ok){
          data = await r.json().catch(() => ({}));
          return res.status(r.status).json(data);
        }
      } else {
        return res.status(r.status).json(data);
      }
    }
    if(wantStream){
      res.status(200);
      res.setHeader('content-type', 'text/event-stream; charset=utf-8');
      res.setHeader('cache-control', 'no-cache, no-transform');
      Readable.fromWeb(r.body).pipe(res);
      return;
    }
    const data = await r.json();
    return res.status(200).json(data);
  }catch(e){
    return res.status(500).json({error:{message: e.message}});
  }
}
