const axios = require('axios');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

async function getTreatmentAdvice(diagnosis) {
  const { crop_type, disease_name, confidence, severity_level, affected_area_percent } = diagnosis;

  const prompt = `You are an expert agricultural plant pathologist. A farmer's plant has been diagnosed with the following:

- Crop: ${crop_type}
- Disease: ${disease_name}
- Confidence: ${confidence}%
- Severity: ${severity_level}
- Affected Area: ${affected_area_percent}%

Provide practical treatment advice in this exact markdown format:

## Diagnosis Summary
Brief 2-sentence summary of the disease and its impact.

## Immediate Actions
- Action 1
- Action 2
- Action 3

## Chemical Treatment
Specific fungicides/pesticides with dosage and application method.

## Organic/Natural Treatment
Natural alternatives that are eco-friendly.

## Prevention Tips
How to prevent recurrence.

## Recovery Timeline
Expected recovery time with proper treatment.

Keep advice practical, specific, and suitable for Indian farmers.`;

  try {
    const response = await axios.post(GEMINI_URL, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
    });

    const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('No response from Gemini');
    return text;
  } catch (err) {
    console.error('Gemini error:', err.response?.data || err.message);
    // Fallback response if API fails
    return `## Treatment Advice for ${disease_name}

**Severity:** ${severity_level} | **Confidence:** ${confidence}%

## Immediate Actions
- Remove and destroy infected plant parts
- Improve air circulation around plants
- Avoid overhead watering

## Treatment
Apply appropriate fungicide/pesticide based on the disease type. Consult your local agricultural extension office for specific recommendations.

## Prevention
- Practice crop rotation
- Use disease-resistant varieties
- Maintain proper plant spacing`;
  }
}

async function getChatResponse({ message, scanContext, conversationHistory }) {
  const systemPrompt = `You are PlantCare AI, an expert agricultural assistant specializing in plant diseases. 
You help farmers identify and treat plant diseases. Be concise, practical, and helpful.
${scanContext ? `\nCurrent scan context: ${JSON.stringify(scanContext)}` : ''}`;

  const history = (conversationHistory || []).map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));

  const contents = [
    { role: 'user', parts: [{ text: systemPrompt }] },
    { role: 'model', parts: [{ text: 'Understood! I am PlantCare AI, ready to help with plant disease diagnosis and treatment.' }] },
    ...history,
    { role: 'user', parts: [{ text: message }] },
  ];

  try {
    const response = await axios.post(GEMINI_URL, {
      contents,
      generationConfig: { temperature: 0.7, maxOutputTokens: 512 },
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
    });

    const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('No response from Gemini');
    return text;
  } catch (err) {
    console.error('Gemini chat error:', err.response?.data || err.message);
    throw new Error('Chat service temporarily unavailable. Please try again.');
  }
}

module.exports = { getTreatmentAdvice, getChatResponse };
