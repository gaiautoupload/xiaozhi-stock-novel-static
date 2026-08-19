# 架構說明

## 原則

1. Google Drive 是內容發布資料源。
2. GitHub repo 是網站可直接讀取的快照與版本庫。
3. GitHub Pages 是純靜態前端。
4. ChatGPT Work 不在日常資料更新的 critical path。
5. Drive 同步失敗時，不刪除 repo 中的上一版資料。
6. 瀏覽器載入失敗時，使用 localStorage 的上一版 JSON fallback。

## 為什麼不是瀏覽器直接抓 Drive？

Google Drive 的下載網址與 CORS／權限行為不是穩定的前端 API。讓瀏覽器直接跨網域讀大量 JSON/MD 很容易碰到：

- CORS
- 302 / confirm download
- private file auth
- cache
- 大量零碎 request

因此採「GitHub Actions 做後端同步器」，但網站仍然是靜態網站，也完全不需要 Work。

## 同步安全

Service Account JSON 只存在 GitHub Actions Secret。
前端永遠看不到 Google private key。
