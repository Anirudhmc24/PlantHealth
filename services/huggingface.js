const axios = require('axios');
const fs = require('fs');

const HF_KEY = process.env.HUGGINGFACE_API_KEY;
const MODEL_ID = 'linkanjarad/mobilenet_v2_1.0_224-plant-disease-identification';

// Try both URLs — new router first, old as fallback
const HF_URLS = [
  `https://router.huggingface.co/hf-inference/models/${MODEL_ID}`,
  process.env.HUGGINGFACE_MODEL_URL,
].filter(Boolean);

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

function estimateAffectedArea(severity, confidence) {
  if (severity === 'Healthy') return 0;
  if (severity === 'Severe')   return Math.round(50 + confidence * 40);
  if (severity === 'Moderate') return Math.round(20 + confidence * 30);
  return Math.round(5 + confidence * 15);
}

async function detectDisease(imagePath) {
  const imageBuffer = fs.readFileSync(imagePath);

  let predictions;
  let lastError;

  for (const url of HF_URLS) {
    if (!url) continue;
    try {
      console.log(`Trying HuggingFace URL: ${url}`);
      const response = await axios.post(url, imageBuffer, {
        headers: {
          Authorization: `Bearer ${HF_KEY}`,
          'Content-Type': 'application/octet-stream',
        },
        timeout: 30000,
      });
      predictions = response.data;
      console.log(`Success with URL: ${url}`);
      break;
    } catch (err) {
      lastError = err;
      const status = err.response?.status;
      console.error(`Failed with ${url}: ${status} - ${err.message}`);
      if (status === 503) {
        throw new Error('AI model is loading, please try again in 20 seconds.');
      }
      // Try next URL on 410
      if (status === 410) continue;
      throw new Error(`HuggingFace API error: ${err.response?.data?.error || err.message}`);
    }
  }

  if (!predictions) {
    throw new Error(`HuggingFace API error: ${lastError?.response?.data?.error || lastError?.message || 'All endpoints failed'}`);
  }

  if (!Array.isArray(predictions) || predictions.length === 0) {
    throw new Error('No predictions returned from model.');
  }

  const top = predictions[0];
  const { crop, disease } = parseLabel(top.label);
  const confidence = parseFloat((top.score * 100).toFixed(1));
  const severity = getSeverityFromConfidence(top.score, disease);
  const affectedArea = estimateAffectedArea(severity, top.score);

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
    confidence,
    severity_level: severity,
    affected_area_percent: affectedArea,
    low_confidence: top.score < 0.80,
    raw_predictions: topPredictions,
  };
}

module.exports = { detectDisease };
