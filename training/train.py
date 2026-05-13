import os
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, random_split, Dataset
from torchvision import transforms, models
from PIL import Image
from tqdm import tqdm

class MultiCropDataset(Dataset):
    def __init__(self, root_dir, transform=None):
        self.root_dir = root_dir
        self.transform = transform
        self.samples = []
        self.classes = []
        
        # Crops to ignore (database files etc)
        ignore = ['db.json', 'plantdisease.db', 'plantdisease.db-shm', 'plantdisease.db-wal', 'PlantVillage']
        
        print(f"Scanning data directory: {root_dir}")
        for item in sorted(os.listdir(root_dir)):
            if item in ignore: continue
            item_path = os.path.join(root_dir, item)
            if not os.path.isdir(item_path): continue
            
            # Check if this directory contains images directly (Flat structure like PlantVillage)
            has_images = any(f.lower().endswith(('.png', '.jpg', '.jpeg', '.bmp', '.webp')) for f in os.listdir(item_path))
            
            if has_images:
                # Root level class (e.g. Potato___Early_blight)
                self._add_class_from_dir(item, item_path)
            else:
                # Nested structure (e.g. rice_leaf/Brown spot)
                print(f"  Processing nested crop: {item}")
                for sub_item in sorted(os.listdir(item_path)):
                    sub_item_path = os.path.join(item_path, sub_item)
                    if not os.path.isdir(sub_item_path): continue
                    
                    full_cls_name = f"{item}_{sub_item}"
                    self._add_class_from_dir(full_cls_name, sub_item_path)
        
        print(f"Total images found: {len(self.samples)}")
        print(f"Total classes: {len(self.classes)}")

    def _add_class_from_dir(self, class_name, dir_path):
        if class_name not in self.classes:
            self.classes.append(class_name)
        
        cls_idx = self.classes.index(class_name)
        count = 0
        for img in os.listdir(dir_path):
            if img.lower().endswith(('.png', '.jpg', '.jpeg', '.bmp', '.webp')):
                self.samples.append((os.path.join(dir_path, img), cls_idx))
                count += 1
        if count > 0:
            print(f"    - Found {count} images for {class_name}")

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        path, target = self.samples[idx]
        try:
            img = Image.open(path).convert('RGB')
        except Exception as e:
            print(f"Error loading {path}: {e}")
            # Return a dummy image if one fails
            img = Image.new('RGB', (224, 224), color='black')
            
        if self.transform:
            img = self.transform(img)
        return img, target

def train_model():
    data_dir = '../data'
    batch_size = 32
    num_epochs = 5  # Reduced for faster feedback, usually sufficient for transfer learning
    learning_rate = 0.001
    model_name = 'plant_health_model.pth'

    if not os.path.exists(data_dir):
        print(f"Error: Data directory {data_dir} not found.")
        return

    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Using device: {device}")

    # Data transforms
    data_transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.RandomHorizontalFlip(),
        transforms.RandomRotation(15),
        transforms.ColorJitter(brightness=0.2, contrast=0.2),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ])

    # Load multi-crop dataset
    full_dataset = MultiCropDataset(data_dir, transform=data_transform)
    if len(full_dataset) == 0:
        print("No images found. Check your data directory structure.")
        return
        
    class_names = full_dataset.classes

    # Split dataset
    train_size = int(0.8 * len(full_dataset))
    val_size = len(full_dataset) - train_size
    train_dataset, val_dataset = random_split(full_dataset, [train_size, val_size])

    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False, num_workers=0)

    # Build model (MobileNetV2)
    weights = models.MobileNet_V2_Weights.DEFAULT
    model = models.mobilenet_v2(weights=weights)
    
    # Freeze initial layers
    for param in model.parameters():
        param.requires_grad = False
        
    # Replace final classifier layer
    num_ftrs = model.classifier[1].in_features
    model.classifier[1] = nn.Linear(num_ftrs, len(class_names))
    model = model.to(device)

    criterion = nn.CrossEntropyLoss()
    # Unfreeze the classifier for training
    optimizer = optim.Adam(model.classifier[1].parameters(), lr=learning_rate)

    best_acc = 0.0
    best_model_wts = model.state_dict()

    for epoch in range(num_epochs):
        print(f'Epoch {epoch+1}/{num_epochs}')
        print('-' * 10)

        for phase in ['train', 'val']:
            if phase == 'train':
                model.train()
                dataloader = train_loader
            else:
                model.eval()
                dataloader = val_loader

            running_loss = 0.0
            running_corrects = 0

            batch_idx = 0
            for inputs, labels in tqdm(dataloader, desc=phase):
                inputs = inputs.to(device)
                labels = labels.to(device)

                optimizer.zero_grad()

                with torch.set_grad_enabled(phase == 'train'):
                    outputs = model(inputs)
                    _, preds = torch.max(outputs, 1)
                    loss = criterion(outputs, labels)

                    if phase == 'train':
                        loss.backward()
                        optimizer.step()

                running_loss += loss.item() * inputs.size(0)
                running_corrects += torch.sum(preds == labels.data)
                
                # Real-time logging every 10 batches
                batch_idx += 1
                if batch_idx % 10 == 0 or batch_idx == len(dataloader):
                    import json
                    log_data = {
                        "epoch": epoch + 1,
                        "num_epochs": num_epochs,
                        "phase": phase,
                        "batch": batch_idx,
                        "total_batches": len(dataloader),
                        "loss": running_loss / (batch_idx * batch_size),
                        "accuracy": float(running_corrects) / (batch_idx * batch_size),
                        "best_accuracy": float(best_acc)
                    }
                    with open('../public/training_log.json', 'w') as f:
                        json.dump(log_data, f)

            epoch_loss = running_loss / len(dataloader.dataset)
            epoch_acc = running_corrects.double() / len(dataloader.dataset)

            print(f'{phase} Loss: {epoch_loss:.4f} Acc: {epoch_acc:.4f}')

            if phase == 'val' and epoch_acc > best_acc:
                best_acc = epoch_acc
                best_model_wts = model.state_dict()

        print()

    print(f'Best val Acc: {best_acc:4f}')
    
    model.load_state_dict(best_model_wts)
    
    # Save model and class mapping
    torch.save({
        'model_state_dict': model.state_dict(),
        'classes': class_names
    }, model_name)
    
    # Also save a copy as wheat_leaf_model.pth for backward compatibility if needed, 
    # but the server should be updated to use the new name.
    torch.save({
        'model_state_dict': model.state_dict(),
        'classes': class_names
    }, 'wheat_leaf_model.pth')
    
    print(f"Model saved to {model_name} (and wheat_leaf_model.pth)")

if __name__ == '__main__':
    train_model()
