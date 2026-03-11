const axios = require('axios');
const fs = require('fs');

const HF_URL = process.env.HUGGINGFACE_MODEL_URL ||
  'https://api-inference.huggingface.co/models/linkanjarad/mobilenet_v2_1.0_224-plant-disease-identification';
const HF_KEY = process.env.HUGGINGFACE_API_KEY;

// ── Label helpers ─────────────────────────────────────────────────────────────
// PlantVillage labels follow the pattern: "Crop___Disease" or "Crop___healthy"
function parseLabel(label) {
  const parts = label.split('___');
  const crop = (parts[0] || 'Unknown').replace(/_/g, ' ');
  const disease = (parts[1] || 'Unknown').replace(/_/g, ' ');
  return { crop, disease };
}

function getSeverityFromConfidence(confidence, diseaseName) {
  if (diseaseName.toLowerCase().includes('healthy')) return 'Healthy';
  if (confidence >= 0.85) return 'Severe';
  if (confidence >= 0.60) return 'Moderate';
  return 'Mild';
}

// Estimate affected leaf area based on severity (model doesn't output this directly)
function estimateAffectedArea(severity, confidence) {
  if (severity === 'Healthy') return 0;
  if (severity === 'Severe')   return Math.round(50 + confidence * 40); // 50–90%
  if (severity === 'Moderate') return Math.round(20 + confidence * 30); // 20–50%
  return Math.round(5 + confidence * 15);                               // 5–20%
}

// ── Main detection function ───────────────────────────────────────────────────
async function detectDisease(imagePath) {
  const imageBuffer = fs.readFileSync(imagePath);

  let predictions;
  try {
    const response = await axios.post(HF_URL, imageBuffer, {
      headers: {
        Authorization: `Bearer ${HF_KEY}`,
        'Content-Type': 'application/octet-stream',
      },
      timeout: 30000,
    });
    predictions = response.data;
  } catch (err) {
    const status = err.response?.status;
    if (status === 503) {
      throw new Error('AI model is loading, please try again in 20 seconds.');
    }
    throw new Error(`HuggingFace API error: ${err.message}`);
  }

  if (!Array.isArray(predictions) || predictions.length === 0) {
    throw new Error('No predictions returned from model.');
  }

  // Top prediction
  const top = predictions[0];
  const { crop, disease } = parseLabel(top.label);
  const confidence = parseFloat((top.score * 100).toFixed(1));
  const severity = getSeverityFromConfidence(top.score, disease);
  const affectedArea = estimateAffectedArea(severity, top.score);

  // Top 5 for display
  const topPredictions = predictions.slice(0, 5).map(p => {
    const parsed = parseLabel(p.label);
    return {
      label: p.label,
      crop: parsed.crop,
      disease: parsed.disease,
      confidence: parseFloat((p.score * 100).toFixed(1)),
    };
  });

  return {
    crop_type: crop,
    disease_name: disease,
    confidence,               // percentage 0–100
    severity_level: severity, // Healthy | Mild | Moderate | Severe
    affected_area_percent: affectedArea,
    low_confidence: top.score < 0.80,
    raw_predictions: topPredictions,
  };
}

module.exports = { detectDisease };
