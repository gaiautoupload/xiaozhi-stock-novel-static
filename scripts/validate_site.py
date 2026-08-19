#!/usr/bin/env python3
from pathlib import Path
import json, sys
R=Path(__file__).resolve().parents[1]
required=["index.html","assets/app.js","assets/styles.css","config/site.json","data/manifest.json","data/feed.index.json","data/catalog.json"]
missing=[x for x in required if not (R/x).exists()]
if missing:
    print("MISSING",missing);sys.exit(1)
for x in ["config/site.json","data/manifest.json","data/feed.index.json","data/catalog.json"]:
    json.loads((R/x).read_text(encoding="utf-8"))
print("OK static site files validated")
