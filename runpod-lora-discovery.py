"""
RunPod LoRA Discovery API
Add this to your RunPod ComfyUI setup to enable LoRA discovery and thumbnails

Place this file in your ComfyUI directory and modify your server to include these endpoints.
"""

import os
import json
import hashlib
from pathlib import Path
from typing import List, Dict, Any, Optional
import safetensors.torch
from PIL import Image
import base64
from io import BytesIO

# Configuration
LORA_DIR = "/workspace/ComfyUI/models/loras"
THUMBNAIL_CACHE_DIR = "/workspace/ComfyUI/thumbnails/loras"
THUMBNAIL_SIZE = (64, 64)

def ensure_cache_dir():
    """Ensure thumbnail cache directory exists"""
    Path(THUMBNAIL_CACHE_DIR).mkdir(parents=True, exist_ok=True)

def get_lora_metadata(lora_path: str) -> Dict[str, Any]:
    """Extract metadata from LoRA safetensors file"""
    try:
        with safetensors.torch.safe_open(lora_path, framework="pt") as f:
            metadata = f.metadata() or {}
            
        # Parse common metadata fields
        name = metadata.get("ss_output_name", "") or Path(lora_path).stem
        description = metadata.get("ss_dataset_dirs", "") or metadata.get("description", "")
        tags = metadata.get("ss_tag_frequency", "") or metadata.get("tags", "")
        
        # Determine type based on metadata or filename
        lora_type = "other"
        filename_lower = Path(lora_path).name.lower()
        
        if any(word in filename_lower for word in ["character", "char", "person", "girl", "boy", "man", "woman"]):
            lora_type = "character"
        elif any(word in filename_lower for word in ["style", "art", "anime", "realistic", "painting"]):
            lora_type = "style"
        elif any(word in filename_lower for word in ["concept", "background", "environment", "scene"]):
            lora_type = "concept"
            
        # Parse tags if it's a JSON string
        parsed_tags = []
        if isinstance(tags, str) and tags.startswith('{'):
            try:
                tag_data = json.loads(tags)
                parsed_tags = list(tag_data.keys())[:10]  # Limit to 10 tags
            except:
                pass
        elif isinstance(tags, str):
            parsed_tags = [tag.strip() for tag in tags.split(',')][:10]
            
        return {
            "name": name or Path(lora_path).stem,
            "description": description[:200] if description else f"LoRA model for {name or 'custom'} generation",
            "tags": parsed_tags,
            "type": lora_type,
            "file_size": os.path.getsize(lora_path),
            "modified_time": os.path.getmtime(lora_path)
        }
        
    except Exception as e:
        print(f"Error reading LoRA metadata from {lora_path}: {e}")
        return {
            "name": Path(lora_path).stem,
            "description": f"LoRA model",
            "tags": [],
            "type": "other",
            "file_size": os.path.getsize(lora_path) if os.path.exists(lora_path) else 0,
            "modified_time": os.path.getmtime(lora_path) if os.path.exists(lora_path) else 0
        }

def generate_lora_thumbnail(lora_path: str) -> Optional[str]:
    """Generate a thumbnail for the LoRA (placeholder for now)"""
    try:
        ensure_cache_dir()
        
        # Create a unique filename for the thumbnail
        lora_hash = hashlib.md5(lora_path.encode()).hexdigest()[:8]
        thumbnail_path = os.path.join(THUMBNAIL_CACHE_DIR, f"{lora_hash}.png")
        
        # Check if thumbnail already exists
        if os.path.exists(thumbnail_path):
            return thumbnail_path
            
        # Generate a simple thumbnail (you can enhance this with actual preview generation)
        img = Image.new('RGB', THUMBNAIL_SIZE, color='#374151')
        
        # Save thumbnail
        img.save(thumbnail_path, 'PNG')
        return thumbnail_path
        
    except Exception as e:
        print(f"Error generating thumbnail for {lora_path}: {e}")
        return None

def discover_loras() -> List[Dict[str, Any]]:
    """Discover all LoRA files in the models directory"""
    loras = []
    
    if not os.path.exists(LORA_DIR):
        print(f"LoRA directory not found: {LORA_DIR}")
        return loras
        
    for root, dirs, files in os.walk(LORA_DIR):
        for file in files:
            if file.endswith('.safetensors'):
                lora_path = os.path.join(root, file)
                relative_path = os.path.relpath(lora_path, LORA_DIR)
                
                # Get metadata
                metadata = get_lora_metadata(lora_path)
                
                # Generate thumbnail
                thumbnail_path = generate_lora_thumbnail(lora_path)
                
                lora_info = {
                    "name": metadata["name"],
                    "filename": relative_path,
                    "type": metadata["type"],
                    "description": metadata["description"],
                    "tags": metadata["tags"],
                    "thumbnail": f"/api/lora-thumbnail?file={relative_path}" if thumbnail_path else None,
                    "strength_recommended": 0.8 if metadata["type"] == "character" else 0.6,
                    "file_size": metadata["file_size"],
                    "modified_time": metadata["modified_time"]
                }
                
                loras.append(lora_info)
                
    # Sort by type and name
    loras.sort(key=lambda x: (x["type"], x["name"]))
    return loras

def get_lora_thumbnail(filename: str) -> Optional[bytes]:
    """Get thumbnail for a specific LoRA file"""
    try:
        lora_path = os.path.join(LORA_DIR, filename)
        if not os.path.exists(lora_path):
            return None
            
        # Generate or get cached thumbnail
        thumbnail_path = generate_lora_thumbnail(lora_path)
        if thumbnail_path and os.path.exists(thumbnail_path):
            with open(thumbnail_path, 'rb') as f:
                return f.read()
                
        return None
        
    except Exception as e:
        print(f"Error getting thumbnail for {filename}: {e}")
        return None

# FastAPI endpoints (add these to your ComfyUI server)
"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

router = APIRouter()

@router.get("/api/loras")
async def get_loras():
    try:
        loras = discover_loras()
        return {"success": True, "loras": loras, "count": len(loras)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/lora-thumbnail")
async def get_lora_thumbnail_endpoint(file: str):
    try:
        thumbnail_data = get_lora_thumbnail(file)
        if thumbnail_data:
            return Response(content=thumbnail_data, media_type="image/png")
        else:
            raise HTTPException(status_code=404, detail="Thumbnail not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Add router to your main FastAPI app
# app.include_router(router)
"""

if __name__ == "__main__":
    # Test the discovery
    loras = discover_loras()
    print(f"Found {len(loras)} LoRA files:")
    for lora in loras[:5]:  # Show first 5
        print(f"  - {lora['name']} ({lora['type']}) - {lora['filename']}")
