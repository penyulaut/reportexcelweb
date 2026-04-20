import http.client, os

xlsx_path = r"dump/202508-all SLA (1).xlsx"
with open(xlsx_path, "rb") as f:
    xlsx_data = f.read()

boundary = "----FormBoundary7MA4YWxkTrZu0gW"

header = (
    "--" + boundary + "\r\n"
    'Content-Disposition: form-data; name="xlsx"; filename="test.xlsx"\r\n'
    "Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n"
    "\r\n"
).encode()
footer = ("\r\n--" + boundary + "--\r\n").encode()
body = header + xlsx_data + footer

conn = http.client.HTTPConnection("localhost", 3000)
conn.request("POST", "/api/generate", body=body, headers={
    "Content-Type": "multipart/form-data; boundary=" + boundary,
    "Content-Length": str(len(body)),
})
res = conn.getresponse()
print("Status:", res.status)
for h in res.getheaders():
    print(f"  {h[0]}: {h[1]}")
data = res.read()
if res.status == 200:
    out = "dump/test_result.docx"
    with open(out, "wb") as f:
        f.write(data)
    print(f"Success! {len(data)} bytes -> {out}")
else:
    print("Error:", data[:500].decode("utf-8", errors="replace"))
