// Vercel Serverless Function for Gemini Multimodal Voice & OpenAI LLM Chat
export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(200).json({ status: 'online', service: 'Dracarys AI Multimodal Voice & Chat Bridge' });
    }

    const { message, audio, mimeType, lang } = req.body || {};
    if ((!message || !message.trim()) && !audio) {
        return res.status(400).json({ error: 'Message or audio input is required' });
    }

    const query = (message || '').trim();
    const isHindi = (lang === 'hi' || lang === 'hi-IN' || lang === 'hindi_devanagari' || lang === 'hinglish');

    const systemPrompt = isHindi
        ? "You are Dracarys AI (डॉ. ड्रेकेरिस), a highly intelligent, friendly, bilingual desktop & web AI assistant. Answer concisely and helpful in natural conversational Hindi (or Hinglish if appropriate). Keep answers concise (under 2-3 sentences) so they can be spoken clearly without bullet points or special symbols."
        : "You are Dracarys AI, an advanced, highly capable, concise, and friendly AI virtual assistant. Provide direct, informative, and natural conversational answers. Keep responses concise (under 2-3 sentences) so they can be spoken naturally without markdown asterisks or bullet points.";

    // 1. Try Google Gemini API (Supports text & direct raw audio)
    const geminiKey = process.env.GEMINI_API_KEY || '';
    if (geminiKey) {
        try {
            const geminiModels = [
                'gemini-3.5-flash-lite',
                'gemini-2.0-flash',
                'gemini-1.5-flash',
                'gemini-flash-latest'
            ];

            const parts = [];
            if (audio) {
                parts.push({
                    text: `${systemPrompt}\n\nListen carefully to the user's voice audio, transcribe their question, and provide a direct, natural spoken response in the same language.`
                });
                parts.push({
                    inlineData: {
                        mimeType: mimeType || 'audio/webm',
                        data: audio
                    }
                });
            } else {
                parts.push({
                    text: `${systemPrompt}\n\nUser Question: ${query}`
                });
            }

            for (const model of geminiModels) {
                try {
                    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 6000);

                    const geminiRes = await fetch(geminiUrl, {
                        method: 'POST',
                        signal: controller.signal,
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ role: 'user', parts: parts }],
                            generationConfig: {
                                temperature: 0.5,
                                maxOutputTokens: 250
                            }
                        })
                    });
                    clearTimeout(timeoutId);

                    if (geminiRes.ok) {
                        const data = await geminiRes.json();
                        const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (candidate && candidate.trim()) {
                            return res.status(200).json({
                                response: candidate.trim(),
                                provider: 'gemini',
                                model: model
                            });
                        }
                    }
                } catch (modelErr) {
                    console.warn(`Gemini model ${model} attempt failed:`, modelErr);
                }
            }
        } catch (geminiError) {
            console.warn('Gemini API call exception:', geminiError);
        }
    }

    // 2. Try OpenAI API Fallback (for text queries)
    const openaiKey = process.env.OPENAI_API_KEY || '';
    if (openaiKey && query) {
        try {
            const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${openaiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: query }
                    ],
                    max_tokens: 500,
                    temperature: 0.7
                })
            });

            if (openaiRes.ok) {
                const openData = await openaiRes.json();
                const reply = openData.choices?.[0]?.message?.content;
                if (reply && reply.trim()) {
                    return res.status(200).json({
                        response: reply.trim(),
                        provider: 'openai',
                        model: 'gpt-4o-mini'
                    });
                }
            }
        } catch (openaiErr) {
            console.warn('OpenAI fallback exception:', openaiErr);
        }
    }

    // 3. Fast Wikipedia Encyclopedia Lookup Fallback (<500ms)
    if (query) {
        try {
            const patterns = [
                /^(?:what is the|what is a|what is an|what is|who is|who was|tell me about|explain|define|where is|how does|why is|what are)\s+(?:the\s+)?(.+)/i,
                /^(?:kya hai|kaun hai|batao|kiske baare me|क्या है|कौन है|बताओ)\s+(.+)/i,
                /(.+?)\s+(?:kya hai|kaun hai|kise kehte hain|क्या है|कौन है|किसे कहते हैं)/i
            ];
            let topic = query.replace(/[?!.,;:]/g, '').trim();
            for (const p of patterns) {
                const m = topic.match(p);
                if (m && m[1]) {
                    topic = m[1].trim();
                    break;
                }
            }

            if (topic && topic.length >= 2) {
                const langPrefix = isHindi ? 'hi' : 'en';
                const wikiUrl = `https://${langPrefix}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topic)}`;
                const wikiController = new AbortController();
                const wikiTimeout = setTimeout(() => wikiController.abort(), 2000);

                const wikiRes = await fetch(wikiUrl, {
                    signal: wikiController.signal,
                    headers: { 'User-Agent': 'DracarysAssistant/2.0' }
                });
                clearTimeout(wikiTimeout);

                if (wikiRes.ok) {
                    const wikiData = await wikiRes.json();
                    const extract = wikiData.extract;
                    if (extract && extract.length > 15) {
                        const sents = extract.split('. ').map(s => s.trim()).filter(Boolean);
                        let shortSummary = sents.slice(0, 2).join('. ');
                        if (!shortSummary.endsWith('.')) shortSummary += '.';
                        return res.status(200).json({
                            response: shortSummary,
                            provider: 'wikipedia',
                            model: 'encyclopedia'
                        });
                    }
                }
            }
        } catch (wikiErr) {
            console.warn('Wikipedia fallback lookup notice:', wikiErr);
        }
    }

    // 4. Fallback response if no keys or API call failed
    const fallbackReply = isHindi
        ? `मैंने आपका प्रश्न "${query || 'वॉइस कमांड'}" प्राप्त किया। ड्रेकेरिस एआई ऑनलाइन है और आपकी सहायता के लिए तैयार है।`
        : `Regarding "${query || 'your voice request'}": Dracarys AI is online and ready with full autonomous intelligence.`;

    return res.status(200).json({
        response: fallbackReply,
        provider: 'fallback'
    });
}
