#!/usr/bin/env python3
"""
migrate_to_vercel.py — One-time data migration from local to Vercel Cloud.

Requirements:
    pip install vercel-blob upstash-redis

Usage:
    export BLOB_READ_WRITE_TOKEN='your_token_here'
    export KV_REST_API_URL='your_url_here'
    export KV_REST_API_TOKEN='your_token_here'
    python3 migrate_to_vercel.py
"""

import os
import json
import uuid
from vercel_blob import put
import redis

DATA_FILE = "data/materials.json"

def migrate():
    # 1. Validate Environment
    blob_token = os.environ.get("BLOB_READ_WRITE_TOKEN")
    redis_url = os.environ.get("REDIS_URL")

    if not all([blob_token, redis_url]):
        print("ERROR: Missing environment variables. Please set BLOB_READ_WRITE_TOKEN and REDIS_URL.")
        return

    if not os.path.exists(DATA_FILE):
        print(f"ERROR: Local data file {DATA_FILE} not found.")
        return

    # 2. Load Local Data
    with open(DATA_FILE, 'r') as f:
        materials = json.load(f)

    print(f"Found {len(materials)} materials to migrate...")

    kv = redis.from_url(redis_url, decode_responses=True)
    new_materials = []

    # 3. Process and Upload
    for m in materials:
        print(f"Migrating: {m['title']}...")
        new_items = []
        for item in m.get('items', []):
            local_path = item['path']
            
            # If it's already a URL, skip upload
            if local_path.startswith('http'):
                new_items.append(item)
                continue

            # Check if file exists locally
            if not os.path.exists(local_path):
                print(f"  Warning: Local file {local_path} not found. Skipping.")
                continue

            # Upload to Vercel Blob
            print(f"  Uploading {local_path} to Vercel Blob...")
            with open(local_path, 'rb') as f_blob:
                blob_data = put(f"uploads/{os.path.basename(local_path)}", f_blob.read())
                new_items.append({
                    "path": blob_data['url'],
                    "description": item.get('description', '')
                })

        m['items'] = new_items
        new_materials.append(m)

    # 4. Save to Cloud KV
    print("Saving updated materials list to Vercel KV...")
    kv.set("materials", json.dumps(new_materials))
    
    print("\nSUCCESS! Your data has been migrated to the cloud.")
    print("You can now verify the 'Recently Added Material' section on your live site.")

if __name__ == "__main__":
    migrate()
