import re
import json
import sys

def extract(encoding):
    try:
        with open('revenue_page.html', 'r', encoding=encoding) as f:
            content = f.read()
            
        match = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', content)
        if match:
            json_str = match.group(1)
            data = json.loads(json_str)
            print(json.dumps(data, indent=2, ensure_ascii=False))
            return True
    except Exception as e:
        pass
    return False

if not extract('utf-8'):
    if not extract('cp950'):
        if not extract('latin-1'):
            print("Failed to extract with utf-8, cp950, or latin-1")
