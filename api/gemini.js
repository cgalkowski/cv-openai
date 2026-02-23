// version 2

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { prompt, systemInstruction } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured on the server.' });
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const payload = {
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json"
      }
    };

    // Only add systemInstruction if provided — Gemini JSON mode works better
    // with the response format enforced by responseMimeType alone
    if (systemInstruction) {
      payload.systemInstruction = {
        parts: [{ text: systemInstruction }]
      };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API Error:", JSON.stringify(data));
      const errMsg = data?.error?.message || `HTTP ${response.status}`;
      return res.status(response.status).json({ error: errMsg });
    }

    // Extract text from candidates — handle both standard and thinking model formats
    const candidate = data?.candidates?.[0];
    if (!candidate) {
      console.error("No candidates in response:", JSON.stringify(data));
      return res.status(500).json({ error: 'No response candidates from Gemini' });
    }

    // Find the text part (skip thought parts in thinking models)
    const parts = candidate?.content?.parts || [];
    const textPart = parts.find(p => p.text !== undefined && !p.thought);
    const text = textPart?.text || parts[0]?.text || '';

    if (!text) {
      console.error("Empty text in response:", JSON.stringify(data));
      return res.status(500).json({ error: 'Empty response from Gemini' });
    }

    return res.status(200).json({ text });

  } catch (error) {
    console.error("Serverless Function Error:", error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
