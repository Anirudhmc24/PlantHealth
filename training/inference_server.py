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

# Check for multi-crop model first, then legacy wheat model
MODEL_PATH = Path(__file__).parent / "plant_health_model.pth"
if not MODEL_PATH.exists():
    MODEL_PATH = Path(__file__).parent / "wheat_leaf_model.pth"

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model = None
classes = []

def parse_class_name(class_name):
    """Parses 'crop_disease' into ('Crop', 'Disease')"""
    if "_" in class_name:
        parts = class_name.split("_", 1)
        crop = parts[0].replace("_", " ").title()
        disease = parts[1].replace("_", " ").title()
        return crop, disease
    return "Unknown", class_name.replace("_", " ").title()

def get_severity(confidence: float, disease_name: str) -> str:
    if "healthy" in disease_name.lower():
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
        print(f"[ERROR] Model not found at {MODEL_PATH}")
        return
    
    print(f"Loading model from {MODEL_PATH}...")
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
    return {"status": "ok", "model_loaded": model is not None, "classes": classes, "model_path": str(MODEL_PATH)}

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
    
    top_class_raw = classes[top_indices[0].item()]
    top_conf = round(top_probs[0].item() * 100, 1)
    
    crop, disease = parse_class_name(top_class_raw)
    severity = get_severity(top_conf, disease)
    affected_area = estimate_affected_area(severity, top_conf)
    
    predictions = []
    for i in range(min(5, len(classes))):
        c_raw = classes[top_indices[i].item()]
        c_crop, c_disease = parse_class_name(c_raw)
        predictions.append({
            "label": c_raw,
            "crop": c_crop,
            "disease": c_disease,
            "confidence": round(top_probs[i].item() * 100, 1),
        })
    
    return {
        "crop_type": crop,
        "disease_name": disease,
        "confidence": top_conf,
        "severity_level": severity,
        "affected_area_percent": affected_area,
        "low_confidence": top_probs[0].item() < 0.70,
        "raw_predictions": predictions,
    }

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=5001, reload=False)
