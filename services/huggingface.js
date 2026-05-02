const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');

const LOCAL_INFERENCE_URL = process.env.LOCAL_INFERENCE_URL || 'http://127.0.0.1:5001';

async function detectDisease(imagePath) {
  const imageBuffer = fs.readFileSync(imagePath);

  const formData = new FormData();
  formData.append('image', imageBuffer, {
    filename: 'leaf.jpg',
    contentType: 'image/jpeg',
  });

  try {
    console.log(`Sending image to local inference server: ${LOCAL_INFERENCE_URL}/predict`);
    const response = await axios.post(`${LOCAL_INFERENCE_URL}/predict`, formData, {
      headers: formData.getHeaders(),
      timeout: 60000,
    });

    const result = response.data;
    console.log(`Local model prediction: ${result.disease_name} (${result.confidence}%)`);
    return result;

  } catch (err) {
    const detail = err.response?.data?.detail || err.message;
    console.error(`Local inference error: ${detail}`);

    if (err.code === 'ECONNREFUSED') {
      throw new Error(
        'Local AI model server is not running. Please start it with: ' +
        'cd training && .\\venv\\Scripts\\python.exe inference_server.py'
      );
    }
    throw new Error(`Local model error: ${detail}`);
  }
}

module.exports = { detectDisease };
