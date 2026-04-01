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
        try:
            if self.path.rstrip('/') == '/api/materials':
                kv = get_kv()
                data = kv.get("materials")
                materials = json.loads(data) if data else []
                self._set_headers()
                self.wfile.write(json.dumps(materials).encode('utf-8'))
                return
            self._set_headers(404)
            self.wfile.write(json.dumps({"error": "Path not found"}).encode('utf-8'))
        except Exception as e:
            print(f"GET Error: {e}")
            self._set_headers(500)
            self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))

    def do_POST(self):
        try:
            kv = get_kv()
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            raw_path = self.path.split('?')[0].rstrip('/')
            
            # Diagnostic Log
            print(f"POST Request: Path={raw_path}, BodySize={content_length}")

            # 1. Reorder
            if raw_path == '/api/materials/reorder':
                new_order_ids = json.loads(body)
                data = kv.get("materials")
                materials = json.loads(data) if data else []
                id_map = {item["id"]: item for item in materials}
                reordered = [id_map[mid] for mid in new_order_ids if mid in id_map]
                for item in materials:
                    if item["id"] not in set(new_order_ids): reordered.append(item)
                kv.set("materials", json.dumps(reordered))
                self._set_headers(200)
                self.wfile.write(json.dumps({"success": True}).encode('utf-8'))
                return

            # 2. Update (e.g. /api/materials/UUID)
            if '/api/materials/' in raw_path:
                material_id = raw_path.split('/')[-1].strip()
                if material_id and material_id != 'materials':
                    update_data = json.loads(body)
                    data = kv.get("materials")
                    materials = json.loads(data) if data else []
                    
                    found_idx = -1
                    for i, m in enumerate(materials):
                        if m.get("id", "").strip() == material_id:
                            found_idx = i
                            break
                    
                    if found_idx != -1:
                        m = materials[found_idx]
                        if "title" in update_data: m["title"] = update_data["title"]
                        if "items" in update_data:
                            for u_item in update_data["items"]:
                                idx = u_item.get("index")
                                if idx is not None and idx < len(m.get("items", [])):
                                    m["items"][idx]["description"] = u_item["description"]
                        kv.set("materials", json.dumps(materials))
                        self._set_headers(200)
                        self.wfile.write(json.dumps({"success": True}).encode('utf-8'))
                        return
                    else:
                        print(f"Update Error: ID {material_id} not found among {len(materials)} items.")
                        self._set_headers(404)
                        self.wfile.write(json.dumps({"error": f"Material {material_id} not found"}).encode('utf-8'))
                        return

            # 3. Create (Multipart)
            if raw_path == '/api/materials':
                import email.message
                content_type = self.headers.get('Content-Type')
                msg = email.message.Message()
                msg['Content-Type'] = content_type
                boundary = msg.get_param('boundary').encode()
                parts = body.split(b'--' + boundary)
                title, uploaded_items, temp_files, temp_descriptions = "", [], [], {}
                for part in parts:
                    if not part or part.strip() in [b'--', b'']: continue
                    header_part, _, data = part.partition(b'\r\n\r\n')
                    headers = email.message_from_bytes(header_part.lstrip())
                    disposition = headers.get('Content-Disposition', '')
                    dis_params = {p.split('=')[0].strip(): p.split('=')[1].strip('"') for p in disposition.split(';') if '=' in p}
                    name = dis_params.get('name')
                    if name == 'title':
                        title = data.rstrip(b'\r\n').decode('utf-8').strip()
                    elif name and name.startswith('desc_'):
                        temp_descriptions[name.replace('desc_', '')] = data.rstrip(b'\r\n').decode('utf-8').strip()
                    elif name == 'image' and 'filename' in dis_params:
                        filename = dis_params['filename']
                        _, ext = os.path.splitext(filename)
                        blob_data = put(f"uploads/{uuid.uuid4()}{ext}", data.rstrip(b'\r\n'))
                        temp_files.append({"path": blob_data['url'], "id": dis_params.get('id', str(len(temp_files)))})
                for f in temp_files:
                    uploaded_items.append({"path": f["path"], "description": temp_descriptions.get(f["id"], "")})
                new_material = {"id": str(uuid.uuid4()), "title": title, "timestamp": int(time.time()), "items": uploaded_items}
                data = kv.get("materials")
                materials = json.loads(data) if data else []
                materials.insert(0, new_material)
                kv.set("materials", json.dumps(materials))
                self._set_headers(201)
                self.wfile.write(json.dumps(new_material).encode('utf-8'))
                return
            
            self._set_headers(404)
            self.wfile.write(json.dumps({"error": f"Unknown POST route: {raw_path}"}).encode('utf-8'))
        except Exception as e:
            print(f"POST Error: {e}")
            self._set_headers(500)
            self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))

    def do_DELETE(self):
        try:
            raw_path = self.path.split('?')[0].rstrip('/')
            print(f"DELETE Request: Path={raw_path}")
            
            if '/api/materials/' in raw_path:
                material_id = raw_path.split('/')[-1].strip()
                kv = get_kv()
                data = kv.get("materials")
                materials = json.loads(data) if data else []
                
                item_to_delete = next((m for m in materials if m.get("id", "").strip() == material_id), None)
                if not item_to_delete:
                    print(f"Delete Error: Material ID {material_id} not found.")
                    self._set_headers(404)
                    self.wfile.write(json.dumps({"error": f"Material {material_id} not found"}).encode('utf-8'))
                    return
                for item in item_to_delete.get("items", []):
                    try: blob_delete(item["path"])
                    except: pass
                materials = [m for m in materials if m.get("id", "").strip() != material_id]
                kv.set("materials", json.dumps(materials))
                self._set_headers(200)
                self.wfile.write(json.dumps({"success": True}).encode('utf-8'))
                return
            self._set_headers(404)
        except Exception as e:
            print(f"DELETE Error: {e}")
            self._set_headers(500)
            self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))

