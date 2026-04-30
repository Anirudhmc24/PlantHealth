# PlantHealth: End-to-End User Guide

Welcome to the PlantHealth project! This guide will walk you through setting up the repository from scratch, whether you want to run the API backend, train the custom machine learning model, or run predictions.

---

## 1. Prerequisites

Before you begin, ensure you have the following installed on your machine:
- **Node.js** (v16+ recommended) and **npm**
- **Python** (v3.9+ recommended)
- **Git**

---

## 2. Setting Up the Node.js API Backend

The core application is a Node.js Express server that handles image uploads, database storage, and external AI API integrations (like Claude for treatment advice).

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/Anirudhmc24/PlantHealth.git
   cd PlantHealth
   ```
2. Install the Node.js dependencies:
   ```bash
   npm install
   ```

### Configuration
1. Copy the example environment file to create your own `.env` file:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` and fill in the required API keys (e.g., Hugging Face API key, Anthropic API key).

### Running the Server
Start the development server:
```bash
npm run dev
```
The server will start on `http://localhost:3000`. You can check its health at `http://localhost:3000/health`.

---

## 3. Machine Learning: Wheat Leaf Disease Model

We have built a custom training pipeline using PyTorch to detect wheat leaf diseases (`Healthy`, `septoria`, and `stripe_rust`).

### Setting Up the Dataset (Not in Git)
Because image datasets are very large, they are ignored by Git. You must download the data manually if you want to train the model.
1. Download the **Wheat Leaf Dataset** from Kaggle:
   [Wheat Leaf Dataset](https://www.kaggle.com/datasets/olyadgetch/wheat-leaf-dataset?resource=download)
2. Extract the dataset and place the folders inside the `data/wheat_leaf/` directory so your structure looks exactly like this:
   ```text
   PlantHealth/
   ├── data/
   │   └── wheat_leaf/
   │       ├── Healthy/
   │       ├── septoria/
   │       └── stripe_rust/
   ```

### Setting Up the Python Environment
We strongly recommend using a virtual environment to manage Python dependencies.
1. Navigate to the training directory:
   ```bash
   cd training
   ```
2. Create and activate a virtual environment:
   **Windows:**
   ```powershell
   python -m venv venv
   .\venv\Scripts\activate
   ```
   **Mac/Linux:**
   ```bash
   python -m venv venv
   source venv/bin/activate
   ```
3. Install the required PyTorch and Machine Learning libraries:
   ```bash
   pip install -r requirements.txt
   ```

### Training the Model
To train the model from scratch using the dataset you downloaded:
```bash
python train.py
```
- This will load a pre-trained MobileNetV2 architecture and fine-tune it on the dataset.
- Training automatically uses the CPU, but will leverage a GPU (CUDA) if available.
- Upon completion (usually 5 epochs), it will output a `wheat_leaf_model.pth` file containing the trained weights.

### Testing/Running Predictions
Once you have the `wheat_leaf_model.pth` file, you can test it on any individual image:
```bash
python predict.py "..\data\wheat_leaf\septoria\sample_image.JPG"
```
The script will output the percentage confidence for each disease category and state its final prediction.

---

## Notes for Teammates

- **Model File**: If you do not want to train the model yourself, ask a team member to share the `wheat_leaf_model.pth` file with you and place it inside the `training/` directory. You will still need to follow the Python environment setup to run `predict.py`.
- **Git Ignores**: The `.gitignore` is configured to ignore the `venv/`, `__pycache__/`, `*.pth` models, and the large `data/` directories to keep the repository lightweight. 
