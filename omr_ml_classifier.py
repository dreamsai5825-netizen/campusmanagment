import os
import sys
import glob
import json
import time
import random
from pathlib import Path
import numpy as np
import cv2

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader

MODEL_DIR = Path(".omr_ml_model")
DATASET_DIR = Path(".omr_ml_dataset")
MODEL_PATH = MODEL_DIR / "bubble_cnn.pth"
METADATA_PATH = MODEL_DIR / "metadata.json"

MODEL_DIR.mkdir(exist_ok=True, parents=True)
DATASET_DIR.mkdir(exist_ok=True, parents=True)
(DATASET_DIR / "unfilled").mkdir(exist_ok=True, parents=True)
(DATASET_DIR / "filled").mkdir(exist_ok=True, parents=True)
(DATASET_DIR / "unlabelled").mkdir(exist_ok=True, parents=True)

class OMRBubbleCNN(nn.Module):
    """3-Layer Convolutional Neural Network for 32x32 OMR Bubble Classification."""
    def __init__(self):
        super(OMRBubbleCNN, self).__init__()
        self.features = nn.Sequential(
            nn.Conv2d(1, 16, kernel_size=3, padding=1),
            nn.BatchNorm2d(16),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2, 2), # 16x16

            nn.Conv2d(16, 32, kernel_size=3, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2, 2), # 8x8

            nn.Conv2d(32, 64, kernel_size=3, padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2, 2)  # 4x4
        )
        self.classifier = nn.Sequential(
            nn.Linear(64 * 4 * 4, 64),
            nn.ReLU(inplace=True),
            nn.Dropout(0.25),
            nn.Linear(64, 2)
        )

    def forward(self, x):
        x = self.features(x)
        x = x.view(x.size(0), -1)
        x = self.classifier(x)
        return x

def preprocess_patch(img_np, target_size=(32, 32)):
    """Preprocess a cropped bubble image into a normalized 1x32x32 torch float tensor."""
    if len(img_np.shape) == 3:
        img_gray = cv2.cvtColor(img_np, cv2.COLOR_BGR2GRAY)
    else:
        img_gray = img_np.copy()

    resized = cv2.resize(img_gray, target_size, interpolation=cv2.INTER_AREA)
    norm = resized.astype(np.float32) / 255.0
    tensor = torch.from_numpy(norm).unsqueeze(0).unsqueeze(0) # (1, 1, 32, 32)
    return tensor, resized

def generate_synthetic_bubble_dataset(output_dir=DATASET_DIR, num_samples_per_class=400):
    """Generates synthetic bubble images (unfilled & filled) for bootstrapping the ML model."""
    unfilled_dir = output_dir / "unfilled"
    filled_dir = output_dir / "filled"
    unfilled_dir.mkdir(exist_ok=True, parents=True)
    filled_dir.mkdir(exist_ok=True, parents=True)

    size = 32
    center = (16, 16)
    radius = 11
    letters = ['A', 'B', 'C', 'D', '1', '2', '3', '4', '0', '5', '6', '7', '8', '9']
    fonts = [cv2.FONT_HERSHEY_SIMPLEX, cv2.FONT_HERSHEY_PLAIN, cv2.FONT_HERSHEY_DUPLEX]

    # Class 0: Unfilled Bubbles (Includes both blank circles and circles containing printed letters/numbers)
    for i in range(num_samples_per_class):
        img = np.ones((size, size), dtype=np.uint8) * random.randint(230, 255)
        # Add slight background noise
        noise = np.random.normal(0, random.uniform(2, 6), (size, size))
        img = np.clip(img + noise, 0, 255).astype(np.uint8)
        # Draw outer circle border
        thickness = random.randint(1, 2)
        color = random.randint(30, 80)
        cv2.circle(img, center, radius, color, thickness)

        # In real OMR sheets, ~80% of unfilled bubbles contain a printed option letter or digit
        if random.random() < 0.85:
            char = random.choice(letters)
            font = random.choice(fonts)
            scale = random.uniform(0.35, 0.45)
            t_thick = 1
            t_color = random.randint(30, 80)
            # Center text approximately inside the circle
            (tw, th), _ = cv2.getTextSize(char, font, scale, t_thick)
            tx = max(2, center[0] - tw // 2 + random.randint(-1, 1))
            ty = max(2, center[1] + th // 2 + random.randint(-1, 1))
            cv2.putText(img, char, (tx, ty), font, scale, t_color, t_thick, cv2.LINE_AA)

        cv2.imwrite(str(unfilled_dir / f"syn_unfilled_{i:04d}.png"), img)

    # Class 1: Filled Bubbles (Solid pen/pencil shading filling >50% of the circle, obscuring any letter)
    for i in range(num_samples_per_class):
        img = np.ones((size, size), dtype=np.uint8) * random.randint(230, 255)
        noise = np.random.normal(0, random.uniform(2, 6), (size, size))
        img = np.clip(img + noise, 0, 255).astype(np.uint8)
        # Draw outer circle border
        cv2.circle(img, center, radius, random.randint(30, 80), 1)

        # Sometimes print a faint background letter that is shaded over
        if random.random() < 0.7:
            char = random.choice(letters)
            cv2.putText(img, char, (11, 21), cv2.FONT_HERSHEY_SIMPLEX, 0.4, 100, 1, cv2.LINE_AA)

        # Draw heavy filled circle (pencil/pen mark) with varying fullness & darkness
        fill_radius = random.randint(8, 12)
        fill_color = random.randint(15, 85)
        ox = center[0] + random.randint(-2, 2)
        oy = center[1] + random.randint(-2, 2)
        cv2.circle(img, (ox, oy), fill_radius, fill_color, -1)
        
        # Add internal shading texture variation
        texture_noise = np.random.normal(0, random.uniform(5, 15), (size, size))
        img = np.clip(img + texture_noise, 0, 255).astype(np.uint8)
        cv2.imwrite(str(filled_dir / f"syn_filled_{i:04d}.png"), img)

class OMRBubbleDataset(Dataset):
    def __init__(self, data_dir=DATASET_DIR):
        self.samples = []
        unfilled_files = glob.glob(str(Path(data_dir) / "unfilled" / "*.png"))
        filled_files = glob.glob(str(Path(data_dir) / "filled" / "*.png"))

        for path in unfilled_files:
            self.samples.append((path, 0))
        for path in filled_files:
            self.samples.append((path, 1))

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        img_path, label = self.samples[idx]
        img = cv2.imread(img_path, cv2.IMREAD_GRAYSCALE)
        if img is None or img.shape != (32, 32):
            img = cv2.resize(img if img is not None else np.zeros((32, 32), dtype=np.uint8), (32, 32))
        tensor = torch.from_numpy(img.astype(np.float32) / 255.0).unsqueeze(0)
        return tensor, torch.tensor(label, dtype=torch.long)

_global_model = None

def get_model():
    global _global_model
    if _global_model is None:
        _global_model = OMRBubbleCNN()
        if MODEL_PATH.exists():
            try:
                _global_model.load_state_dict(torch.load(str(MODEL_PATH), map_location="cpu"))
            except Exception as e:
                print(f"[OMR_ML] Model load error, retraining baseline: {e}")
                train_and_save_model()
        else:
            print("[OMR_ML] Model path not found. Generating synthetic dataset and training baseline model...")
            generate_synthetic_bubble_dataset()
            train_and_save_model()
        _global_model.eval()
    return _global_model

def train_and_save_model(epochs=6, batch_size=32, lr=0.001):
    global _global_model
    dataset = OMRBubbleDataset()
    if len(dataset) < 50:
        generate_synthetic_bubble_dataset()
        dataset = OMRBubbleDataset()

    train_loader = DataLoader(dataset, batch_size=batch_size, shuffle=True)
    model = OMRBubbleCNN()
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=lr)

    model.train()
    total_loss = 0.0
    correct = 0
    total = 0

    for epoch in range(epochs):
        epoch_loss = 0.0
        epoch_correct = 0
        epoch_total = 0
        for inputs, targets in train_loader:
            optimizer.zero_grad()
            outputs = model(inputs)
            loss = criterion(outputs, targets)
            loss.backward()
            optimizer.step()

            epoch_loss += loss.item() * inputs.size(0)
            _, predicted = outputs.max(1)
            epoch_correct += predicted.eq(targets).sum().item()
            epoch_total += targets.size(0)

        total_loss = epoch_loss / max(epoch_total, 1)
        acc = epoch_correct / max(epoch_total, 1)

    torch.save(model.state_dict(), str(MODEL_PATH))
    _global_model = model
    _global_model.eval()

    meta = {
        "last_trained": time.strftime("%Y-%m-%d %H:%M:%S"),
        "total_samples": len(dataset),
        "training_accuracy": round(acc * 100, 2),
        "loss": round(total_loss, 4)
    }
    with open(METADATA_PATH, "w") as f:
        json.dump(meta, f, indent=2)

    return meta

def predict_bubble_patches(patches_list):
    """Predicts a list of cropped numpy array patches.
    Returns list of dicts: {'is_filled': bool, 'confidence': float, 'prob_filled': float, 'darkness_ratio': float}
    """
    if not patches_list:
        return []

    model = get_model()
    tensors = []
    inner_mask = np.zeros((32, 32), dtype=np.uint8)
    cv2.circle(inner_mask, (16, 16), 8, 255, -1)
    
    darkness_ratios = []
    for patch in patches_list:
        tensor, resized = preprocess_patch(patch)
        tensors.append(tensor)
        
        # Calculate darkness ratio inside the bubble inner core (radius 8)
        inner_pixels = resized[inner_mask > 0]
        mean_intensity = float(np.mean(inner_pixels)) if len(inner_pixels) > 0 else 255.0
        darkness = (255.0 - mean_intensity) / 255.0
        darkness_ratios.append(darkness)

    batch = torch.cat(tensors, dim=0) # (N, 1, 32, 32)
    with torch.no_grad():
        outputs = model(batch)
        probs = torch.softmax(outputs, dim=1) # (N, 2)

    results = []
    for i in range(len(patches_list)):
        prob_unfilled = float(probs[i][0].item())
        prob_filled = float(probs[i][1].item())
        darkness = darkness_ratios[i]

        # A bubble is genuinely filled only if ML probability is high AND physical interior is shaded (darkness >= 0.30)
        # Real unfilled bubbles with printed letters have darkness around 0.08 - 0.20.
        is_filled = (prob_filled > 0.60) and (darkness >= 0.30)
        confidence = float(max(prob_unfilled, prob_filled))

        results.append({
            "is_filled": is_filled,
            "confidence": round(confidence, 4),
            "prob_filled": round(prob_filled, 4),
            "prob_unfilled": round(prob_unfilled, 4),
            "darkness_ratio": round(darkness, 4)
        })
    return results

def crop_bubble_patch_from_page(page_img, sample_name, option_letter="A"):
    """Crops a 32x32 bubble patch from a full page scan based on question sample_name."""
    H, W = page_img.shape[:2]
    if H < 100 or W < 100:
        return page_img

    scale_x = W / 1191.0
    scale_y = H / 1684.0

    column_x_origins = [156.0, 425.4, 694.8, 964.1]
    bubbles_gap = 39.7
    row_height = 30.618
    group_spacer = 9.07
    start_y = 636.2

    col_idx = 0
    q_num = 1
    
    parts = sample_name.split("_")
    for part in parts:
        part_l = part.lower()
        if part_l.startswith("c") and part_l[1:].isdigit():
            col_idx = max(0, int(part_l[1:]) - 1)
        elif part_l.startswith("col") and part_l[3:].isdigit():
            col_idx = max(0, int(part_l[3:]))
        elif "." in part:
            sub_q = part.split(".")
            try:
                q_num = int(sub_q[1])
            except (ValueError, IndexError):
                q_num = 1

    opt_idx = 0
    opt_upper = option_letter.upper() if option_letter else "A"
    if opt_upper == "B": opt_idx = 1
    elif opt_upper == "C": opt_idx = 2
    elif opt_upper == "D": opt_idx = 3

    r_idx = (q_num - 1) % 30
    g_idx = r_idx // 5
    rem = r_idx % 5

    x_origin = column_x_origins[col_idx % len(column_x_origins)]
    cx = (x_origin + opt_idx * bubbles_gap) * scale_x
    cy = (start_y + (g_idx * 5 * row_height) + (g_idx * group_spacer) + (rem * row_height)) * scale_y

    cx = int(round(cx))
    cy = int(round(cy))

    r = 16
    x1 = max(0, cx - r)
    x2 = min(W, cx + r)
    y1 = max(0, cy - r)
    y2 = min(H, cy + r)

    cropped = page_img[y1:y2, x1:x2]
    return cropped

def save_active_sample(patch_np, label=None, sample_name=None, option_letter="A"):
    """Saves a cropped bubble patch for active learning fine-tuning."""
    if sample_name is None:
        sample_name = f"sample_{int(time.time() * 1000)}_{random.randint(100,999)}.png"

    if patch_np.shape[0] > 200 and patch_np.shape[1] > 200:
        patch_np = crop_bubble_patch_from_page(patch_np, sample_name, option_letter)

    if label == 1 or label == "filled":
        save_path = DATASET_DIR / "filled" / sample_name
    elif label == 0 or label == "unfilled":
        save_path = DATASET_DIR / "unfilled" / sample_name
    else:
        save_path = DATASET_DIR / "unlabelled" / sample_name

    _, resized = preprocess_patch(patch_np)
    cv2.imwrite(str(save_path), resized)
    return str(save_path)

def get_dataset_samples(limit=60, offset=0, category="all"):
    """Returns base64 images and metadata of active learning dataset samples."""
    samples = []
    
    filled_paths = sorted(glob.glob(str(DATASET_DIR / "filled" / "*.png")), key=os.path.getmtime, reverse=True)
    unfilled_paths = sorted(glob.glob(str(DATASET_DIR / "unfilled" / "*.png")), key=os.path.getmtime, reverse=True)

    items = []
    if category in ["all", "filled"]:
        for p in filled_paths:
            items.append((p, "filled"))
    if category in ["all", "unfilled"]:
        for p in unfilled_paths:
            items.append((p, "unfilled"))

    if category == "all":
        items.sort(key=lambda x: os.path.getmtime(x[0]), reverse=True)

    total_count = len(items)
    page_items = items[offset:offset+limit]

    import base64
    for path_str, label in page_items:
        try:
            with open(path_str, "rb") as f:
                b64 = base64.b64encode(f.read()).decode("utf-8")
                samples.append({
                    "name": Path(path_str).name,
                    "label": label,
                    "base64Image": f"data:image/png;base64,{b64}"
                })
        except Exception:
            pass

    return {
        "total": total_count,
        "filled_count": len(filled_paths),
        "unfilled_count": len(unfilled_paths),
        "samples": samples
    }

def get_model_status():
    dataset_len = len(OMRBubbleDataset())
    unlabelled_len = len(glob.glob(str(DATASET_DIR / "unlabelled" / "*.png")))

    meta = {}
    if METADATA_PATH.exists():
        try:
            with open(METADATA_PATH, "r") as f:
                meta = json.load(f)
        except Exception:
            pass

    return {
        "model_loaded": True,
        "model_path": str(MODEL_PATH),
        "total_labeled_samples": dataset_len,
        "unlabelled_samples": unlabelled_len,
        "last_trained": meta.get("last_trained", "Never"),
        "training_accuracy": meta.get("training_accuracy", 0.0),
        "loss": meta.get("loss", 0.0)
    }

if __name__ == "__main__":
    print("[OMR_ML] Testing ML Classifier Module...")
    status = get_model_status()
    print("Initial status:", status)
    if not MODEL_PATH.exists():
        print("Training baseline model...")
        meta = train_and_save_model()
        print("Training completed:", meta)
    
    dummy_patch = np.ones((30, 30), dtype=np.uint8) * 50
    preds = predict_bubble_patches([dummy_patch])
    print("Test prediction on dark patch:", preds)
