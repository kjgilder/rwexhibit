boundary="----WebKitFormBoundary7MA4YWxkTrZu0gW"
body="--${boundary}\r\nContent-Disposition: form-data; name=\"title\"\r\n\r\nUpdated title\r\n--${boundary}\r\nContent-Disposition: form-data; name=\"existing_items\"\r\n\r\n[]\r\n--${boundary}--\r\n"

curl -v -X POST http://localhost:8000/api/materials/bb2d962e-2f36-480b-acfd-1fdf56bbc742 \
  -H "Content-Type: multipart/form-data; boundary=${boundary}" \
  --data-binary "$body"
