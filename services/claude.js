const axios = require('axios');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

async function getTreatmentAdvice(diagnosis) {
  const { crop_type, disease_name, confidence, severity_level, affected_area_percent } = diagnosis;

  const prompt = `You are an expert agricultural plant pathologist specializing in South Asian farming, particularly India. A farmer's plant has been diagnosed with the following:

- Crop: ${crop_type}
- Disease: ${disease_name}
- Confidence: ${confidence}%
- Severity: ${severity_level}
- Affected Area: ${affected_area_percent}%

Please provide highly insightful, practical, and detailed treatment advice in this exact markdown format:

## 📋 Diagnosis Overview
Briefly explain the disease, its primary causes (environmental, fungal, etc.), and how severely it impacts the plant at this stage.

## 🚨 Immediate Actions
- Detailed action 1 (e.g., precise pruning instructions)
- Detailed action 2 (e.g., isolation or water management)

## 🧪 Chemical Treatment
Provide specific, locally available chemical treatments (e.g., mentioning active ingredients like Mancozeb, Copper Oxychloride, etc., common in India).
- **Product/Active Ingredient:** [Name]
- **Dosage:** [Exact amount per liter of water]
- **Application Method:** [How and when to spray]

## 🌿 Organic/Natural Alternatives
Provide eco-friendly, accessible alternatives.
- **Solution:** [e.g., Neem oil extract]
- **Preparation & Application:** [How to mix and apply]

## 🛡️ Prevention & Environmental Care
- Explain how to modify the environment (humidity, spacing, watering schedule) to prevent recurrence.

## ⚠️ Safety Warning
- Brief note on protective gear or safety periods before harvesting.

Ensure the tone is encouraging, professional, and accessible to a farmer. Do not use overly academic jargon without explaining it.`;

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

async function getImprovedAdvice(scanContext, feedback) {
  const prompt = `You are PlantCare AI, an expert agricultural pathologist. A user has reported that a previous AI diagnosis was incorrect.
  
Original AI Diagnosis:
- Crop: ${scanContext.crop_type || 'Unknown'}
- AI Predicted Disease: ${scanContext.disease_name || 'Unknown'} (Incorrect)
- Severity: ${scanContext.severity_level || 'Unknown'}

User Correction & Feedback:
- User's Corrected Disease: ${feedback.correct_disease || 'Not explicitly provided by user'}
- User Comments/Observations: ${feedback.comments || 'None'}

Based on the user's correction and observations, provide a completely revised and highly accurate treatment plan for the true disease. If the user didn't provide a specific disease name but provided comments describing the symptoms, do your best to infer the correct issue.

Provide the advice in the exact same markdown format as the standard diagnosis, focusing on practical, actionable steps for farmers (especially in India):

## 📋 Revised Diagnosis
Acknowledge the correction and briefly explain this disease based on the user's input.

## 🚨 Immediate Actions
- Detailed action 1
- Detailed action 2

## 🧪 Chemical Treatment
- Specific products, dosage, and application method.

## 🌿 Organic/Natural Alternatives
- Natural treatments and preparation.

## 🛡️ Prevention & Environmental Care
- Prevention steps.

## ⚠️ Safety Warning
- Safety notes.`;

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
    console.error('Gemini error for improved advice:', err.response?.data || err.message);
    return '## Error\nUnable to generate improved advice at this time. Please try again later.';
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

module.exports = { getTreatmentAdvice, getImprovedAdvice, getChatResponse };
