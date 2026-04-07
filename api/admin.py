import os
import json
import time
import secrets
import hashlib
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse
import redis

# Security config
SESSION_TTL_SECONDS = 7 * 24 * 3600
SALT_SIZE = 16
HASH_ITERATIONS = 100000

def get_kv():
    url = os.environ.get("REDIS_URL")
    if not url:
        raise ValueError("REDIS_URL environment variable not set")
    return redis.from_url(url, decode_responses=True)

def _hash_password(password: str, salt: str = None) -> dict:
    if salt is None:
        salt = secrets.token_hex(SALT_SIZE)
    key = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt.encode("utf-8"), HASH_ITERATIONS
    )
    return {"passwordHash": key.hex(), "salt": salt}

def _verify_password(password: str, record: dict) -> bool:
    salt = record.get("salt")
    expected_hash = record.get("passwordHash")
    if not salt or not expected_hash:
        return False
    computed = _hash_password(password, salt)
    return computed["passwordHash"] == expected_hash

def _load_admin() -> dict:
    kv = get_kv()
    admin_str = kv.get("admin_account")
    if not admin_str:
        default_email = "ally.jacobs@vanderbilt.edu"
        default_password = "allyjacobs"
        record = _hash_password(default_password)
        admin = {"email": default_email, **record}
        kv.set("admin_account", json.dumps(admin))
        return admin
    return json.loads(admin_str)

def _save_admin(admin: dict) -> None:
    kv = get_kv()
    kv.set("admin_account", json.dumps(admin))

def _parse_cookies(cookie_header: str | None) -> dict:
    if not cookie_header:
        return {}
    cookies = {}
    for part in cookie_header.split(";"):
        if "=" in part:
            k, v = part.split("=", 1)
            cookies[k.strip()] = v.strip()
    return cookies

def _get_session_email(headers) -> str | None:
    cookies = _parse_cookies(headers.get("Cookie"))
    token = cookies.get("rwexhibit_session")
    if not token:
        return None
    kv = get_kv()
    session_str = kv.get(f"session:{token}")
    if not session_str:
        return None
    session = json.loads(session_str)
    return session.get("email")

def _create_session(email: str) -> str:
    token = secrets.token_urlsafe(32)
    session = {"email": email}
    kv = get_kv()
    kv.setex(f"session:{token}", SESSION_TTL_SECONDS, json.dumps(session))
    return token

def _destroy_session(headers) -> None:
    cookies = _parse_cookies(headers.get("Cookie"))
    token = cookies.get("rwexhibit_session")
    if token:
        kv = get_kv()
        kv.delete(f"session:{token}")

class handler(BaseHTTPRequestHandler):
    def _set_headers(self, status=200, content_type="application/json", extra_headers=None):
        self.send_response(status)
        self.send_header('Content-type', content_type)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        if extra_headers:
            for k, v in extra_headers.items():
                self.send_header(k, v)
        self.end_headers()

    def do_OPTIONS(self):
        self._set_headers()

    def do_GET(self):
        try:
            parsed_path = urlparse(self.path)
            raw_path = parsed_path.path.rstrip('/')
            
            if raw_path == "/api/admin/me":
                email = _get_session_email(self.headers)
                if not email:
                    self._set_headers(401)
                    self.wfile.write(json.dumps({"error": "Not authenticated"}).encode("utf-8"))
                    return
                self._set_headers(200)
                self.wfile.write(json.dumps({"email": email}).encode("utf-8"))
                return
            
            self._set_headers(404)
            self.wfile.write(json.dumps({"error": "Path not found"}).encode('utf-8'))
        except Exception as e:
            self._set_headers(500)
            self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))

    def do_POST(self):
        try:
            parsed_path = urlparse(self.path)
            raw_path = parsed_path.path.rstrip('/')
            
            if raw_path == "/api/admin/login":
                content_length = int(self.headers.get("Content-Length", 0))
                post_data = self.rfile.read(content_length)
                payload = json.loads(post_data or b"{}")
                email = (payload.get("email") or "").strip().lower()
                password = payload.get("password") or ""
                
                admin = _load_admin()
                if email != (admin.get("email") or "").strip().lower() or not _verify_password(password, admin):
                    self._set_headers(401)
                    self.wfile.write(json.dumps({"error": "Invalid credentials"}).encode("utf-8"))
                    return

                token = _create_session(admin["email"])
                self._set_headers(
                    200,
                    extra_headers={
                        "Set-Cookie": f"rwexhibit_session={token}; HttpOnly; SameSite=Lax; Path=/",
                    },
                )
                self.wfile.write(json.dumps({"success": True}).encode("utf-8"))
                return

            if raw_path == "/api/admin/logout":
                _destroy_session(self.headers)
                self._set_headers(
                    200,
                    extra_headers={"Set-Cookie": "rwexhibit_session=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax"},
                )
                self.wfile.write(json.dumps({"success": True}).encode("utf-8"))
                return

            if raw_path == "/api/admin/change-password":
                email = _get_session_email(self.headers)
                if not email:
                    self._set_headers(401)
                    self.wfile.write(json.dumps({"error": "Not authenticated"}).encode("utf-8"))
                    return

                content_length = int(self.headers.get("Content-Length", 0))
                post_data = self.rfile.read(content_length)
                payload = json.loads(post_data or b"{}")
                old_password = payload.get("oldPassword") or ""
                new_password = payload.get("newPassword") or ""

                if len(new_password) < 8:
                    self._set_headers(400)
                    self.wfile.write(json.dumps({"error": "New password must be at least 8 characters"}).encode("utf-8"))
                    return

                admin = _load_admin()
                if not _verify_password(old_password, admin):
                    self._set_headers(401)
                    self.wfile.write(json.dumps({"error": "Old password is incorrect"}).encode("utf-8"))
                    return

                updated = {"email": admin["email"], **_hash_password(new_password)}
                _save_admin(updated)
                self._set_headers(200)
                self.wfile.write(json.dumps({"success": True}).encode("utf-8"))
                return

            self._set_headers(404)
            self.wfile.write(json.dumps({"error": f"Unknown POST route: {raw_path}"}).encode('utf-8'))
            
        except Exception as e:
            self._set_headers(500)
            self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
