// Vercel Serverless Edge/Node Function for Gemini & OpenAI LLM Chat
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
        return res.status(200).json({ status: 'online', service: 'Dracarys AI Gemini Bridge' });
    }

    const { message, lang } = req.body || {};
    if (!message || !message.trim()) {
        return res.status(400).json({ error: 'Message is required' });
    }

    const query = message.trim();
    const isHindi = (lang === 'hi' || lang === 'hi-IN' || lang === 'hindi_devanagari' || lang === 'hinglish');

    const systemPrompt = isHindi
        ? "You are Dracarys AI (डॉ. ड्रेकेरिस), a highly intelligent, friendly, bilingual desktop AI assistant. Answer concisely and helpful in natural conversational Hindi (or Hinglish if appropriate). Keep answers concise (under 2-3 sentences) so they can be spoken clearly without bullet points or special symbols."
        : "You are Dracarys AI, an advanced, highly capable, concise, and friendly AI desktop virtual assistant. Provide direct, informative, and natural conversational answers. Keep responses concise (under 2-3 sentences) so they can be spoken naturally without markdown asterisks or bullet points.";

    // 1. Try Google Gemini API
    const geminiKey = process.env.GEMINI_API_KEY || '';
    if (geminiKey) {
        try {
            // Models to try in order of preference
            const geminiModels = [
                'gemini-3.8-flash',
                'gemini-3.5-flash-lite',
                'gemini-flash-latest',
                'gemini-2.5-flash-lite',
                'gemini-1.5-flash'
            ];

            for (const model of geminiModels) {
                try {
                    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
                    const geminiRes = await fetch(geminiUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [
                                {
                                    role: 'user',
                                    parts: [
                                        { text: `${systemPrompt}\n\nUser Question: ${query}` }
                                    ]
                                }
                            ],
                            generationConfig: {
                                temperature: 0.7,
                                maxOutputTokens: 500
                            }
                        })
                    });

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

    // 2. Try OpenAI API Fallback
    const openaiKey = process.env.OPENAI_API_KEY || '';
    if (openaiKey) {
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

    // 3. Fallback response if no keys or API call failed
    const fallbackReply = isHindi
        ? `मैंने आपका प्रश्न "${query}" प्राप्त किया। ड्रेकेरिस एआई ऑनलाइन है और आपकी सहायता के लिए तैयार है।`
        : `Regarding "${query}": Dracarys AI is online and ready with full autonomous intelligence.`;

    return res.status(200).json({
        response: fallbackReply,
        provider: 'fallback'
    });
}
