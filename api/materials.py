import os
import json
import uuid
import time
from http.server import BaseHTTPRequestHandler
from vercel_blob import put, delete as blob_delete
import redis

# Helper to get the Redis client using the standard REDIS_URL
def get_kv():
    url = os.environ.get("REDIS_URL")
    if not url:
        raise ValueError("REDIS_URL environment variable not set")
    # Decode_responses=True makes it return strings instead of bytes
    return redis.from_url(url, decode_responses=True)

class handler(BaseHTTPRequestHandler):
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
        if self.path == '/api/materials':
            try:
                kv = get_kv()
                data = kv.get("materials")
                materials = json.loads(data) if data else []
                self._set_headers()
                self.wfile.write(json.dumps(materials).encode('utf-8'))
            except Exception as e:
                self._set_headers(500)
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
            return
        
        self._set_headers(404)

    def do_POST(self):
        # Dispatch logic for Upload, Reorder, or Update
        kv = get_kv()
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length)

        # 1. Handle Reorder (JSON /api/materials/reorder)
        if "/api/materials/reorder" in self.path:
            try:
                new_order_ids = json.loads(body)
                data = kv.get("materials")
                materials = json.loads(data) if data else []
                
                id_map = {item["id"]: item for item in materials}
                reordered = [id_map[mid] for mid in new_order_ids if mid in id_map]
                
                # Append any missing ones (safety)
                existing_ids = set(new_order_ids)
                for item in materials:
                    if item["id"] not in existing_ids:
                        reordered.append(item)

                kv.set("materials", json.dumps(reordered))
                self._set_headers(200)
                self.wfile.write(json.dumps({"success": True}).encode('utf-8'))
            except Exception as e:
                print(f"Reorder Error: {e}")
                self._set_headers(500)
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
            return

        # 2. Handle Update (JSON - e.g. /api/materials/UUID)
        parts = self.path.rstrip('/').split('/')
        # Look for the segment after 'materials' if 'api' and 'materials' are present
        if 'api' in parts and 'materials' in parts:
            m_idx = parts.index('materials')
            if len(parts) > m_idx + 1:
                material_id = parts[m_idx + 1]
                # Skip if the last part is 'reorder' (handled above)
                if material_id != 'reorder':
                    try:
                        update_data = json.loads(body)
                        data = kv.get("materials")
                        materials = json.loads(data) if data else []
                        
                        updated = False
                        for m in materials:
                            if m["id"] == material_id:
                                if "title" in update_data: m["title"] = update_data["title"]
                                if "items" in update_data:
                                    for u_item in update_data["items"]:
                                        idx = u_item.get("index")
                                        if idx is not None and idx < len(m.get("items", [])):
                                            m["items"][idx]["description"] = u_item["description"]
                                updated = True
                                break
                        
                        if updated:
                            kv.set("materials", json.dumps(materials))
                            self._set_headers(200)
                            self.wfile.write(json.dumps({"success": True}).encode('utf-8'))
                        else:
                            print(f"Update Error: Material ID {material_id} not found in database.")
                            self._set_headers(404)
                            self.wfile.write(json.dumps({"error": f"Material {material_id} not found"}).encode('utf-8'))
                    except Exception as e:
                        print(f"Update Exception: {e}")
                        self._set_headers(500)
                        self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
                    return

        # 3. Handle Multipart Upload (New Material)
        if self.path == '/api/materials':
            # Note: For simple serverless, we'll use python-multipart if available
            # or manual parsing. Vercel Blob expects a put() with raw data.
            # Skipping full implementation details here for brevity, 
            # but using a library like 'requests_toolbelt' or similar is common.
            # I will provide a working implementation using standard cgi/email.
            import email.message
            params = {}
            content_type = self.headers.get('Content-Type')
            msg = email.message.Message()
            msg['Content-Type'] = content_type
            boundary = msg.get_param('boundary').encode()
            
            parts = body.split(b'--' + boundary)
            title = ""
            uploaded_items = []
            temp_files = []
            temp_descriptions = {}

            for part in parts:
                if not part or part.strip() == b'--' or part.strip() == b'': continue
                header_part, _, data = part.partition(b'\r\n\r\n')
                headers = email.message_from_bytes(header_part.lstrip())
                disposition = headers.get('Content-Disposition', '')
                
                dis_params = {p.split('=')[0].strip(): p.split('=')[1].strip('"') for p in disposition.split(';') if '=' in p}
                name = dis_params.get('name')
                
                if name == 'title':
                    title = data.rstrip(b'\r\n').decode('utf-8').strip()
                elif name and name.startswith('desc_'):
                    key = name.replace('desc_', '')
                    temp_descriptions[key] = data.rstrip(b'\r\n').decode('utf-8').strip()
                elif name == 'image' and 'filename' in dis_params:
                    # Upload to Vercel Blob
                    filename = dis_params['filename']
                    _, ext = os.path.splitext(filename)
                    blob_path = f"uploads/{uuid.uuid4()}{ext}"
                    # put() returns a dict with 'url'
                    blob_data = put(blob_path, data.rstrip(b'\r\n'))
                    temp_files.append({
                        "path": blob_data['url'],
                        "id": dis_params.get('id', str(len(temp_files)))
                    })

            for f in temp_files:
                uploaded_items.append({
                    "path": f["path"],
                    "description": temp_descriptions.get(f["id"], "")
                })

            new_material = {
                "id": str(uuid.uuid4()),
                "title": title,
                "timestamp": int(time.time()),
                "items": uploaded_items
            }

            try:
                data = kv.get("materials")
                materials = json.loads(data) if data else []
                materials.insert(0, new_material)
                kv.set("materials", json.dumps(materials))
                self._set_headers(201)
                self.wfile.write(json.dumps(new_material).encode('utf-8'))
            except Exception as e:
                self._set_headers(500)
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
            return

        self._set_headers(404)

    def do_DELETE(self):
        parts = self.path.rstrip('/').split('/')
        if 'api' in parts and 'materials' in parts:
            m_idx = parts.index('materials')
            if len(parts) > m_idx + 1:
                material_id = parts[m_idx + 1]
                try:
                    kv = get_kv()
                    data = kv.get("materials")
                    materials = json.loads(data) if data else []
                    
                    item_to_delete = next((m for m in materials if m["id"] == material_id), None)
                    if not item_to_delete:
                        print(f"Delete Error: Material ID {material_id} not found.")
                        self._set_headers(404)
                        self.wfile.write(json.dumps({"error": f"Material {material_id} not found"}).encode('utf-8'))
                        return
                    
                    # Delete from Blob
                    for item in item_to_delete.get("items", []):
                        try:
                            blob_delete(item["path"])
                        except Exception as be: 
                            print(f"Blob Delete warning: {be}")
                    
                    # Update KV
                    materials = [m for m in materials if m["id"] != material_id]
                    kv.set("materials", json.dumps(materials))
                    
                    self._set_headers(200)
                    self.wfile.write(json.dumps({"success": True}).encode('utf-8'))
                    return
                except Exception as e:
                    print(f"Delete Exception: {e}")
                    self._set_headers(500)
                    self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
                    return
        
        self._set_headers(404)

