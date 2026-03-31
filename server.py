import http.server
import socketserver
import json
import os
import uuid
import time
from urllib.parse import urlparse
import email.message

PORT = 8000
DATA_FILE = "data/materials.json"
UPLOAD_DIR = "assets/uploads"

# Ensure directories exist
os.makedirs("data", exist_ok=True)
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Initialize JSON file if it doesn't exist
if not os.path.exists(DATA_FILE):
    with open(DATA_FILE, 'w') as f:
        json.dump([], f)
else:
    # Migration logic: convert old formats to new per-item metadata format
    try:
        with open(DATA_FILE, 'r') as f:
            materials_data = json.load(f)
        
        migrated = False
        new_materials = []
        
        for m in materials_data:
            if "items" not in m:
                migrated = True
                items = []
                
                # Case 1: Oldest format (imagePath string)
                if "imagePath" in m:
                    items.append({
                        "path": m["imagePath"],
                        "description": m.get("description", "")
                    })
                # Case 2: Intermediate format (images array + global description)
                elif "images" in m:
                    global_desc = m.get("description", "")
                    for idx, path in enumerate(m["images"]):
                        items.append({
                            "path": path,
                            "description": global_desc if idx == 0 else ""
                        })
                
                new_entry = {
                    "id": m["id"],
                    "title": m["title"],
                    "timestamp": m["timestamp"],
                    "items": items
                }
                new_materials.append(new_entry)
            else:
                new_materials.append(m)
                
        if migrated:
            with open(DATA_FILE, 'w') as f:
                json.dump(new_materials, f, indent=4)
            print("Successfully migrated materials.json to per-item metadata format.")
    except Exception as e:
        print(f"Error during migration: {e}")

class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    
    def _set_headers(self, status=200, content_type="application/json"):
        self.send_response(status)
        self.send_header('Content-type', content_type)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_OPTIONS(self):
        self._set_headers()

    def do_GET(self):
        parsed_path = urlparse(self.path)
        
        if parsed_path.path == '/api/materials':
            try:
                with open(DATA_FILE, 'r') as f:
                    data = json.load(f)
                self._set_headers()
                self.wfile.write(json.dumps(data).encode('utf-8'))
            except Exception as e:
                self._set_headers(500)
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
            return
            
        return super().do_GET()

    def do_POST(self):
        parsed_path = urlparse(self.path)
        
        if parsed_path.path == '/api/materials/reorder':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            try:
                new_order_ids = json.loads(post_data)
                with open(DATA_FILE, 'r') as f:
                    materials = json.load(f)
                
                id_map = {item["id"]: item for item in materials}
                reordered = []
                for mid in new_order_ids:
                    if mid in id_map:
                        reordered.append(id_map[mid])
                
                existing_ids = set(new_order_ids)
                for item in materials:
                    if item["id"] not in existing_ids:
                        reordered.append(item)
                
                with open(DATA_FILE, 'w') as f:
                    json.dump(reordered, f, indent=4)
                
                self._set_headers(200)
                self.wfile.write(json.dumps({"success": True}).encode('utf-8'))
            except Exception as e:
                self._set_headers(500)
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
            return

        # --- Handle Update (POST /api/materials/{id}) ---
        path_parts = parsed_path.path.split('/')
        if len(path_parts) == 4 and path_parts[1] == 'api' and path_parts[2] == 'materials':
            material_id = path_parts[3]
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            
            try:
                update_data = json.loads(post_data)
                with open(DATA_FILE, 'r') as f:
                    materials = json.load(f)
                
                # Find and update
                updated = False
                for m in materials:
                    if m["id"] == material_id:
                        if "title" in update_data:
                            m["title"] = update_data["title"]
                        if "items" in update_data:
                            # update_data["items"] is [ { index, description } ]
                            for update_item in update_data["items"]:
                                idx = update_item.get("index")
                                if idx is not None and idx < len(m.get("items", [])):
                                    m["items"][idx]["description"] = update_item["description"]
                        updated = True
                        break
                
                if not updated:
                    self._set_headers(404)
                    return
                
                with open(DATA_FILE, 'w') as f:
                    json.dump(materials, f, indent=4)
                
                self._set_headers(200)
                self.wfile.write(json.dumps({"success": True}).encode('utf-8'))
            except Exception as e:
                self._set_headers(500)
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
            return

        if parsed_path.path == '/api/materials':
            content_type = self.headers.get('Content-Type')
            if not content_type or 'multipart/form-data' not in content_type:
                self._set_headers(400)
                return

            msg = email.message.Message()
            msg['Content-Type'] = content_type
            boundary = msg.get_param('boundary')
            
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            parts = body.split(b'--' + boundary.encode())
            
            title = ""
            uploaded_items = []
            temp_files = [] 
            temp_descriptions = {}

            for part in parts:
                if not part or part.strip() == b'--' or part.strip() == b'':
                    continue
                
                header_part, _, data = part.partition(b'\r\n\r\n')
                headers = email.message_from_bytes(header_part.lstrip())
                disposition = headers.get('Content-Disposition', '')
                
                params = {}
                for param in disposition.split(';'):
                    if '=' in param:
                        k, v = param.strip().split('=', 1)
                        params[k] = v.strip('"')
                
                name = params.get('name')
                
                if name == 'title':
                    title = data.rstrip(b'\r\n').decode('utf-8').strip()
                elif name and name.startswith('desc_'):
                    # The name is 'desc_UUID' or 'desc_index'
                    key = name.replace('desc_', '')
                    temp_descriptions[key] = data.rstrip(b'\r\n').decode('utf-8').strip()
                elif name == 'image' and 'filename' in params:
                    filename = params['filename']
                    # We need a way to link this file part to its description.
                    # Standard multipart/form-data doesn't guarantee order, 
                    # but usually it's same order as append().
                    # However, to be safe, if we have multiple files with same 'name', 
                    # we'll use their original index in the selection list.
                    
                    _, ext = os.path.splitext(filename)
                    unique_name = f"{uuid.uuid4()}{ext}"
                    filepath = os.path.join(UPLOAD_DIR, unique_name)
                    
                    with open(filepath, 'wb') as f:
                        f.write(data.rstrip(b'\r\n'))
                        
                    temp_files.append({
                        "path": f"{UPLOAD_DIR}/{unique_name}",
                        "id": params.get('id', str(len(temp_files))) # custom id passed from frontend
                    })

            # Match files to descriptions based on ID/index
            for f in temp_files:
                uploaded_items.append({
                    "path": f["path"],
                    "description": temp_descriptions.get(f["id"], "")
                })

            if not title or not uploaded_items:
                self._set_headers(400)
                self.wfile.write(json.dumps({"error": "Title and images are required"}).encode('utf-8'))
                return
            
            new_material = {
                "id": str(uuid.uuid4()),
                "title": title,
                "timestamp": int(time.time()),
                "items": uploaded_items
            }
            
            try:
                with open(DATA_FILE, 'r') as f:
                    materials = json.load(f)
                materials.insert(0, new_material)
                with open(DATA_FILE, 'w') as f:
                    json.dump(materials, f, indent=4)
                self._set_headers(201)
                self.wfile.write(json.dumps(new_material).encode('utf-8'))
            except Exception as e:
                self._set_headers(500)
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
            return

    def do_DELETE(self):
        parsed_path = urlparse(self.path)
        path_parts = parsed_path.path.split('/')
        
        if len(path_parts) == 4 and path_parts[1] == 'api' and path_parts[2] == 'materials':
            material_id = path_parts[3]
            try:
                with open(DATA_FILE, 'r') as f:
                    materials = json.load(f)
                
                item_to_delete = next((m for m in materials if m["id"] == material_id), None)
                if not item_to_delete:
                    self._set_headers(404)
                    return
                
                # Delete files
                for item in item_to_delete.get("items", []):
                    if os.path.exists(item["path"]):
                        os.remove(item["path"])
                
                materials = [m for m in materials if m["id"] != material_id]
                with open(DATA_FILE, 'w') as f:
                    json.dump(materials, f, indent=4)
                
                self._set_headers(200)
                self.wfile.write(json.dumps({"success": True}).encode('utf-8'))
            except Exception as e:
                self._set_headers(500)
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
            return
            
        self._set_headers(404)

class NoCacheCustomHTTPRequestHandler(CustomHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

if __name__ == "__main__":
    with socketserver.TCPServer(("", PORT), NoCacheCustomHTTPRequestHandler) as httpd:
        print(f"Serving at port {PORT}")
        httpd.serve_forever()
