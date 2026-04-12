import requests
import json

url = 'http://localhost:8001/api/materials/dummy-id'
data = {
    'title': 'Test Title',
    'existing_items': json.dumps([{"path": "assets/uploads/test.jpg", "description": "test"}])
}
files = [
    ('image', ('test.jpg', b'dummy content', 'image/jpeg')),
    ('desc_0', (None, 'desc for test.jpg'))
]
try:
    res = requests.post(url, data=data, files=files)
    print(res.status_code, res.text)
except Exception as e:
    print("Error:", e)
