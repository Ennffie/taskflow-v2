export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json'
    };
    
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    // Health check
    if (url.pathname === '/health' && request.method === 'GET') {
      return new Response(JSON.stringify({ok: true, model: 'deepseek/deepseek-chat-v3-0324', provider: 'openrouter'}), { headers: corsHeaders });
    }
    
    // Chat endpoint
    if (url.pathname === '/chat' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { text, session_id, context } = body;
        
        const userName = context?.current_user_name || 'Boss';
        const today = new Date().toISOString().slice(0, 10);
        
        const systemPrompt = `你係 Silly，Task 管理助手。識講廣東話，語氣似後生女仔，輕鬆自然。

風格：
- 直接、簡潔、專注工作
- 少少 personal touch 就夠，唔好太長
- 唔好 small talk
- 一句關心就夠，例如「辛苦晒～」或「無錯吧～」

任務：
- 幫 Bro 睇 task、加 task、改 task
- 直接講重點，唔好長篇大論
- 俾具體建議，唔淨係提醒

記住團隊成員：
- Enfield (Bro)：Manager，唔能遲交 task
- Alice：鍾意唱歌 🎤
- Silvie：下年結婚 💍，基督徒
- Pamela：鍾意睇 Viu TV、電影 🎬，鍾意飲 coffee ☕
- Claire：好靚，好細心 ✨
- Shani：好叻，有創意 🌟

重要：當用戶講「CR???」或「CRCE???」或類似 task name，直接 search。Done / 已完成嘅 task 絕對唔算 overdue。

支援 action:
- create_task: 必須有 title
- update_task: 必須有 task_ref + 要改嘅 field  
- delete_task: 必須有 task_ref

輸出格式:
###ACTION###{"action":"create_task","title":"...","due_date":"YYYY-MM-DD","status":"todo","assignee":"${userName}"}###END###
###ACTION###{"action":"update_task","task_ref":"...","status":"..."}###END###
###ACTION###{"action":"delete_task","task_ref":"..."}###END###
唔操作就唔好放。

今日日期: ${today}
用戶名: ${userName}`;

        const messages = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ];
        
        // Call OpenRouter
        const openRouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
            'HTTP-Referer': 'https://taskflow-v2.vercel.app',
            'X-Title': 'TaskFlow AI'
          },
          body: JSON.stringify({
            model: 'deepseek/deepseek-chat-v3-0324',
            messages,
            temperature: 0.2,
            max_tokens: 500
          })
        });
        
        if (!openRouterResponse.ok) {
          const errorText = await openRouterResponse.text();
          return new Response(JSON.stringify({reply: `AI 暫時無法回應：HTTP ${openRouterResponse.status}`}), { headers: corsHeaders });
        }
        
        const data = await openRouterResponse.json();
        const replyText = data.choices?.[0]?.message?.content || '收到。';
        
        // Extract action
        let action = null;
        const actionMatch = replyText.match(/###ACTION###(.*?)###END###/s);
        if (actionMatch) {
          try {
            action = JSON.parse(actionMatch[1].trim());
          } catch (e) {
            // ignore parse error
          }
        }
        
        // Clean reply (remove action markup)
        const cleanReply = replyText.replace(/###ACTION###.*?###END###/gs, '').trim();
        
        return new Response(JSON.stringify({
          reply: cleanReply,
          action: action
        }), { headers: corsHeaders });
        
      } catch (error) {
        return new Response(JSON.stringify({reply: `AI 暫時無法回應：${error.message}`}), { headers: corsHeaders });
      }
    }
    
    return new Response(JSON.stringify({error: 'Not found'}), { status: 404, headers: corsHeaders });
  }
};
