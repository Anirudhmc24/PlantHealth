import io
import torch
import torch.nn as nn
from torchvision import models, transforms
from PIL import Image
from pathlib import Path

try:
    from fastapi import FastAPI, UploadFile, File, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
except ImportError:
    import subprocess, sys
    subprocess.check_call([sys.executable, "-m", "pip", "install", "fastapi", "uvicorn[standard]"])
    from fastapi import FastAPI, UploadFile, File, HTTPException
    from fastapi.middleware.cors import CORSMiddleware

import uvicorn

app = FastAPI(title="PlantHealth Local Inference Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_PATH = Path(__file__).parent / "wheat_leaf_model.pth"

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model = None
classes = []

def get_severity(confidence: float, disease_name: str) -> str:
    if disease_name.lower() == "healthy":
        return "Healthy"
    if confidence >= 85:
        return "Severe"
    if confidence >= 60:
        return "Moderate"
    return "Mild"

def estimate_affected_area(severity: str, confidence: float) -> int:
    if severity == "Healthy":
        return 0
    if severity == "Severe":
        return int(50 + (confidence / 100) * 40)
    if severity == "Moderate":
        return int(20 + (confidence / 100) * 30)
    return int(5 + (confidence / 100) * 15)

def load_model():
    global model, classes
    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Model not found at {MODEL_PATH}")
    
    checkpoint = torch.load(MODEL_PATH, map_location=device)
    classes = checkpoint["classes"]
    
    weights = models.MobileNet_V2_Weights.DEFAULT
    m = models.mobilenet_v2(weights=weights)
    num_ftrs = m.classifier[1].in_features
    m.classifier[1] = nn.Linear(num_ftrs, len(classes))
    m.load_state_dict(checkpoint["model_state_dict"])
    m = m.to(device)
    m.eval()
    model = m
    print(f"[OK] Model loaded. Classes: {classes}")

transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])

@app.on_event("startup")
def startup_event():
    load_model()

@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": model is not None, "classes": classes}

@app.post("/predict")
async def predict(image: UploadFile = File(...)):
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded.")
    
    contents = await image.read()
    try:
        img = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image file.")
    
    input_tensor = transform(img).unsqueeze(0).to(device)
    
    with torch.no_grad():
        outputs = model(input_tensor)
        probabilities = torch.nn.functional.softmax(outputs[0], dim=0)
    
    top_probs, top_indices = torch.topk(probabilities, len(classes))
    
    top_class = classes[top_indices[0].item()]
    top_conf = round(top_probs[0].item() * 100, 1)
    
    severity = get_severity(top_conf, top_class)
    affected_area = estimate_affected_area(severity, top_conf)
    
    predictions = [
        {
            "label": classes[idx.item()],
            "crop": "Wheat",
            "disease": classes[idx.item()],
            "confidence": round(top_probs[i].item() * 100, 1),
        }
        for i, idx in enumerate(top_indices)
    ]
    
    return {
        "crop_type": "Wheat",
        "disease_name": top_class,
        "confidence": top_conf,
        "severity_level": severity,
        "affected_area_percent": affected_area,
        "low_confidence": top_probs[0].item() < 0.80,
        "raw_predictions": predictions,
    }

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=5001, reload=False)
