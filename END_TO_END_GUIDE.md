# PlantHealth: End-to-End User Guide

Welcome to the PlantHealth project! This guide will walk you through setting up the repository from scratch — covering the backend server, the web frontend, and the custom AI model.

---

## 1. Prerequisites

Before you begin, ensure you have the following installed on your machine:
- **Node.js** (v16+ recommended) and **npm** — [Download here](https://nodejs.org/)
- **Python** (v3.9+ recommended) — [Download here](https://python.org/)
- **Git**

---

## 2. Clone the Repository

```bash
git clone https://github.com/Anirudhmc24/PlantHealth.git
cd PlantHealth
```

---

## 3. Setting Up the Node.js Backend

The backend is an Express server that:
- Serves the web frontend directly
- Handles user authentication (register/login)
- Sends uploaded images to the local Python AI model
- Generates treatment advice via Gemini AI
- Stores scan history in a local JSON database

### Install Dependencies
```bash
npm install
```

### Configure API Keys
Copy the example environment file:
```bash
# Windows:
copy .env.example .env

# Mac/Linux:
cp .env.example .env
```

Open `.env` and fill in:
```
ANTHROPIC_API_KEY=your_key_here         # (Optional - legacy)
GEMINI_API_KEY=your_gemini_key_here     # For treatment advice
HUGGINGFACE_API_KEY=your_hf_key_here    # (Not needed if using local model)
```

> **Note:** The Gemini API key is used for generating treatment advice. If you don't have one, the app will use a built-in fallback treatment message.

---

## 4. Setting Up the Local AI Model (Python)

We use a custom-trained **MobileNetV2** model to classify plant diseases across multiple crops (**Wheat, Corn, and Rice**). The trained model is included in the repository at `training/plant_health_model.pth`.

### Set Up Python Environment
```bash
cd training

# Windows:
python -m venv venv
.\venv\Scripts\activate

# Mac/Linux:
python -m venv venv
source venv/bin/activate
```

### Install Python Dependencies
```bash
pip install -r requirements.txt
```
This installs PyTorch, FastAPI, and other required packages (~115 MB).

### Start the AI Inference Server
```bash
# From inside the training/ directory:
python inference_server.py
```

You should see:
```
[OK] Model loaded. Classes: ['Healthy', 'septoria', 'stripe_rust']
INFO:     Uvicorn running on http://127.0.0.1:5001
```

Keep this terminal open.

---

## 5. Running the Web Application

Open a **second terminal** and run the Node.js server:
```bash
# From the root PlantHealth/ directory:
node server.js
```

You should see:
```
✅ Database ready (lowdb JSON)
🌱 Plant Disease API running on http://localhost:3000
```

Now open your browser and go to **http://localhost:3000**

---

## 6. Using the Application

### Step-by-Step User Flow:
1. **Landing Page** (`/`) — Click "Get Started for Free"
2. **Register** (`/register.html`) — Create a farmer account with your name, email, and password
3. **Dashboard** (`/dashboard.html`) — You'll see a drag-and-drop upload zone
4. **Upload a leaf image** — Drag an image or click to browse. Supported formats: JPG, PNG, WEBP
5. **Click "Analyze Image"** — The AI model will classify the disease (takes ~1-2 seconds)
6. **Result Page** (`/result.html?id=...`) — You'll see:
   - The detected **Disease Name** and **Crop Type**
   - **Severity**, **Confidence %**, and **Affected Area %** metrics
   - A full **Treatment Recommendations** guide with immediate actions, chemical treatment options, organic alternatives, and prevention tips

---

### Adding New Crops
You can expand the model's capability by simply dropping new crop folders into `data/`. The structure should be:
```
PlantHealth/
├── data/
│   ├── wheat_leaf/
│   │   ├── Healthy/
│   │   └── septoria/
│   ├── corn_leaf/
│   │   ├── Blight/
│   │   └── Healthy/
│   └── rice_leaf/
│       └── Brown spot/
```

### Run Training
```bash
cd training
# (Make sure venv is activated)
python train.py
```
- The script automatically scans all folders in `data/` and creates a multi-class model.
- Training runs for 10 epochs using transfer learning.
- Saves the best model to `training/plant_health_model.pth`.

---

## 8. Running Predictions from the Command Line

You can also test the model directly without the web interface:
```bash
cd training
python predict.py "..\data\wheat_leaf\septoria\los(10).JPG"
```

Output:
```
Prediction for ..\data\wheat_leaf\septoria\los(10).JPG:
Healthy: 1.91%
septoria: 93.59%
stripe_rust: 4.50%
---
Final Prediction: septoria
```

---

## 9. Project Structure

```
PlantHealth/
├── server.js                  # Main Express server + frontend hosting
├── package.json               # Node.js dependencies
├── .env.example               # Template for environment variables
├── public/                    # Web frontend (HTML/CSS/JS)
│   ├── index.html             # Landing page
│   ├── login.html             # Login page
│   ├── register.html          # Registration page
│   ├── dashboard.html         # Image upload dashboard
│   ├── result.html            # Disease result & treatment page
│   ├── css/style.css          # Global styles
│   └── js/
│       ├── auth.js            # Authentication logic
│       ├── app.js             # Dashboard upload logic
│       └── result.js          # Result page data fetching
├── routes/                    # API route handlers
│   ├── auth.js                # Register, login, logout
│   ├── detect.js              # Image upload & detection
│   ├── chat.js                # AI chat (Gemini)
│   ├── history.js             # Scan history
│   └── feedback.js            # User feedback
├── services/                  # Business logic
│   ├── database.js            # lowdb JSON database
│   ├── huggingface.js         # Local AI model client
│   └── claude.js              # Gemini treatment advice client
├── training/                  # ML training pipeline
│   ├── train.py               # PyTorch model training script (supports multi-crop)
│   ├── predict.py             # CLI prediction utility
│   ├── inference_server.py    # FastAPI local model server (port 5001)
│   ├── requirements.txt       # Python dependencies
│   └── plant_health_model.pth # Trained multi-crop model weights
└── data/                      # Runtime data (git-ignored)
    └── plantdisease.db / db.json
```

---

## 10. Notes for Teammates

- **Model file** (`wheat_leaf_model.pth`) is included in the repo (~9 MB). No need to retrain unless you want to improve accuracy.
- **Dataset** is NOT in git (too large). Download from Kaggle only if you need to retrain.
- **Both servers must be running** at the same time for the app to work — the Python inference server on port `5001` AND the Node.js server on port `3000`.
- **Database** (`data/db.json`) is local and git-ignored. Each developer will have their own local user accounts.
