// version 2

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { prompt, systemInstruction } = req.body;
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured on the server.' });
  }

  try {
    const url = 'https://api.openai.com/v1/chat/completions';

    const messages = [];

    // Add system message if provided
    if (systemInstruction) {
      messages.push({ role: 'system', content: systemInstruction });
    }

    messages.push({ role: 'user', content: prompt });

    const payload = {
      model: 'gpt-4o',
      messages,
      temperature: 0.2,
      max_tokens: 4000,
      response_format: { type: 'json_object' }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    // Safely parse the response — OpenAI occasionally returns plain text on certain errors
    let data;
    const rawBody = await response.text();
    try {
      data = JSON.parse(rawBody);
    } catch {
      console.error('Non-JSON response from OpenAI:', rawBody.substring(0, 300));
      return res.status(502).json({ error: `Unexpected response from OpenAI: ${rawBody.substring(0, 120)}` });
    }

    if (!response.ok) {
      console.error('OpenAI API Error:', JSON.stringify(data));
      const errMsg = data?.error?.message || `HTTP ${response.status}`;
      return res.status(response.status).json({ error: errMsg });
    }

    // Check finish reason — 'length' means the response was cut off mid-JSON
    const finishReason = data?.choices?.[0]?.finish_reason;
    if (finishReason === 'length') {
      console.error('OpenAI response truncated — max_tokens reached');
      return res.status(500).json({ error: 'Response was too long and was cut off. Try reducing the CV length.' });
    }

    // Check for content filter refusal
    if (finishReason === 'content_filter') {
      return res.status(500).json({ error: 'Request was blocked by content filter.' });
    }

    const text = data?.choices?.[0]?.message?.content || '';

    if (!text) {
      console.error('Empty text in response:', JSON.stringify(data));
      return res.status(500).json({ error: 'Empty response from OpenAI' });
    }

    return res.status(200).json({ text });

  } catch (error) {
    console.error('Serverless Function Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
