import sys
import os
import torch
import torch.nn as nn
from torchvision import models, transforms
from PIL import Image

def predict(image_path, model_path=None):
    if model_path is None:
        # Check for multi-crop model first, then legacy wheat model
        model_path = 'plant_health_model.pth'
        if not os.path.exists(model_path):
            model_path = 'wheat_leaf_model.pth'

    if not os.path.exists(model_path):
        print(f"Error: Model file {model_path} not found.")
        return

    print(f"Using model: {model_path}")
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    
    # Load checkpoint
    checkpoint = torch.load(model_path, map_location=device)
    classes = checkpoint['classes']
    
    # Build model architecture
    weights = models.MobileNet_V2_Weights.DEFAULT
    model = models.mobilenet_v2(weights=weights)
    num_ftrs = model.classifier[1].in_features
    model.classifier[1] = nn.Linear(num_ftrs, len(classes))
    
    # Load weights
    model.load_state_dict(checkpoint['model_state_dict'])
    model = model.to(device)
    model.eval()
    
    # Transform
    transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ])
    
    try:
        image = Image.open(image_path).convert('RGB')
        input_tensor = transform(image).unsqueeze(0).to(device)
        
        with torch.no_grad():
            outputs = model(input_tensor)
            probabilities = torch.nn.functional.softmax(outputs[0], dim=0)
            
        print(f"\nResults for: {image_path}")
        print("-" * 30)
        
        # Sort by probability
        probs, indices = torch.sort(probabilities, descending=True)
        
        for i in range(min(5, len(classes))):
            idx = indices[i].item()
            print(f"{classes[idx]:<25}: {probs[i].item()*100:>6.2f}%")
            
        print("-" * 30)
        predicted_class = classes[indices[0].item()]
        print(f"Final Prediction: {predicted_class}")
        
    except Exception as e:
        print(f"Error predicting image: {e}")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python predict.py <image_path> [model_path]")
    else:
        img_path = sys.argv[1]
        mod_path = sys.argv[2] if len(sys.argv) > 2 else None
        predict(img_path, mod_path)
