const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-opus-4-5';

// ── System prompt ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are an expert agricultural plant pathologist assistant helping farmers diagnose and treat plant diseases.

Your responses must:
- Be practical and actionable — farmers need to act NOW
- Use simple language, avoiding complex scientific jargon
- Structure treatment advice clearly: immediate steps first, then ongoing care
- Always mention safety precautions for chemical treatments
- Suggest both chemical AND organic/eco-friendly alternatives
- Flag clearly when professional agronomist consultation is needed (severe cases)
- Be concise — max 300 words for recommendations

Response format for treatment advice (use exactly these section headers):
**🔍 Diagnosis Summary**
**⚠️ Severity & Urgency**
**🌿 Immediate Actions (Today)**
**💊 Treatment Options**
- Chemical: [product, dosage, frequency]
- Organic: [eco-friendly alternative]
**🛡️ Prevention & Future Care**
**👨‍🌾 Expert Consultation Needed?** [Yes/No + reason]`;

// ── Treatment recommendations ─────────────────────────────────────────────────
async function getTreatmentAdvice(diagnosisData) {
  const { crop_type, disease_name, confidence, severity_level, affected_area_percent } = diagnosisData;

  const userPrompt = `
Plant scan results:
- Crop: ${crop_type}
- Disease detected: ${disease_name}
- Confidence: ${confidence}%
- Severity: ${severity_level}
- Affected leaf area: ${affected_area_percent}%

Please provide complete treatment recommendations for this farmer.
  `.trim();

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 800,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });

  return message.content[0].text;
}

// ── Conversational Q&A ────────────────────────────────────────────────────────
async function chat(messages, scanContext) {
  const contextBlock = scanContext
    ? `Current scan context:
- Crop: ${scanContext.crop_type}
- Disease: ${scanContext.disease_name}
- Severity: ${scanContext.severity_level}
- Confidence: ${scanContext.confidence}%
- Affected area: ${scanContext.affected_area_percent}%
- Initial treatment advice already given.

Answer farmer questions based on this specific diagnosis.`
    : 'No specific scan context. Answer general plant disease and farming questions.';

  const fullSystem = `${SYSTEM_PROMPT}\n\n${contextBlock}`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 500,
    system: fullSystem,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
  });

  return response.content[0].text;
}

// ── Feedback-aware re-analysis ────────────────────────────────────────────────
async function getImprovedAdvice(originalDiagnosis, feedbackContext) {
  const prompt = `
A farmer reported that our diagnosis was incorrect.
Original diagnosis: ${originalDiagnosis.disease_name} on ${originalDiagnosis.crop_type}
Farmer's correction: ${feedbackContext.correct_disease || 'not specified'}
Additional comments: ${feedbackContext.comments || 'none'}

Please provide revised treatment advice based on the farmer's feedback.
  `.trim();

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 800,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  return message.content[0].text;
}

module.exports = { getTreatmentAdvice, chat, getImprovedAdvice };
