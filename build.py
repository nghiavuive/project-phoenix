"""Tạo index.html (trang hoàn chỉnh để tự đăng lên bất kỳ dịch vụ web tĩnh nào) từ page.html.

    python build.py
"""
from pathlib import Path

here = Path(__file__).parent
page = (here / "page.html").read_text(encoding="utf-8")
head, _, body = page.partition("</style>")
doc = f"""<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
<meta name="theme-color" content="#0b1220">
<style>body{{margin:0}}[hidden]{{display:none!important}}</style>
{head.strip()}
</style>
</head>
<body>
{body.strip()}
</body>
</html>
"""
(here / "index.html").write_text(doc, encoding="utf-8")
print("Đã tạo index.html")
