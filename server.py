import http.server
import socketserver
import json
import os
import uuid
from urllib.parse import urlparse, parse_qs
import cgi
import shutil

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

class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    
    def _set_headers(self, status=200, content_type="application/json"):
        self.send_response(status)
        self.send_header('Content-type', content_type)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
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
            
        # Serve static files for everything else
        return super().do_GET()

    def do_POST(self):
        parsed_path = urlparse(self.path)
        
        if parsed_path.path == '/api/materials':
            # Parse the multipart form data
            ctype, pdict = cgi.parse_header(self.headers.get('content-type'))
            if ctype == 'multipart/form-data':
                pdict['boundary'] = bytes(pdict['boundary'], "utf-8")
                
                # Use FieldStorage to parse the form
                form = cgi.FieldStorage(
                    fp=self.rfile, 
                    headers=self.headers,
                    environ={'REQUEST_METHOD': 'POST',
                            'CONTENT_TYPE': self.headers['Content-Type'],
                            }
                )
                
                if 'title' not in form or 'image' not in form:
                    self._set_headers(400)
                    self.wfile.write(json.dumps({"error": "Missing title or image"}).encode('utf-8'))
                    return
                    
                title = form['title'].value
                fileitem = form['image']
                
                if fileitem.filename:
                    # Generate unique ID and secure filename
                    material_id = str(uuid.uuid4())
                    _, ext = os.path.splitext(fileitem.filename)
                    secure_filename = f"{material_id}{ext}"
                    filepath = os.path.join(UPLOAD_DIR, secure_filename)
                    
                    # Save the file
                    with open(filepath, 'wb') as f:
                        f.write(fileitem.file.read())
                        
                    # Save metadata
                    new_item = {
                        "id": material_id,
                        "title": title,
                        "imagePath": f"{UPLOAD_DIR}/{secure_filename}",
                        "timestamp": int(os.path.getmtime(filepath)) # Use file time
                    }
                    
                    try:
                        with open(DATA_FILE, 'r') as f:
                            materials = json.load(f)
                        
                        materials.insert(0, new_item) # Add to front
                        
                        with open(DATA_FILE, 'w') as f:
                            json.dump(materials, f, indent=4)
                            
                        self._set_headers(201)
                        self.wfile.write(json.dumps(new_item).encode('utf-8'))
                    except Exception as e:
                        self._set_headers(500)
                        self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
                else:
                    self._set_headers(400)
                    self.wfile.write(json.dumps({"error": "No file uploaded"}).encode('utf-8'))
            else:
                self._set_headers(400)
                self.wfile.write(json.dumps({"error": "Invalid content type"}).encode('utf-8'))
            return

    def do_DELETE(self):
        parsed_path = urlparse(self.path)
        path_parts = parsed_path.path.split('/')
        
        if len(path_parts) == 4 and path_parts[1] == 'api' and path_parts[2] == 'materials':
            material_id = path_parts[3]
            
            try:
                with open(DATA_FILE, 'r') as f:
                    materials = json.load(f)
                    
                # Find the item to delete
                item_to_delete = next((item for item in materials if item["id"] == material_id), None)
                
                if not item_to_delete:
                    self._set_headers(404)
                    self.wfile.write(json.dumps({"error": "Material not found"}).encode('utf-8'))
                    return
                    
                # Delete the physical file
                file_path = item_to_delete["imagePath"]
                if os.path.exists(file_path):
                    os.remove(file_path)
                    
                # Remove from JSON array
                materials = [item for item in materials if item["id"] != material_id]
                
                with open(DATA_FILE, 'w') as f:
                    json.dump(materials, f, indent=4)
                    
                self._set_headers(200)
                self.wfile.write(json.dumps({"success": True}).encode('utf-8'))
            except Exception as e:
                self._set_headers(500)
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
            return
            
        self._set_headers(404)
        self.wfile.write(json.dumps({"error": "Endpoint not found"}).encode('utf-8'))

# Handler prevents caching so updates show instantly
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
