# 小智股海發財記｜GitHub Pages 靜態版

這個 repo 的目的只有一個：**網站平常不再依賴 ChatGPT Work。**

小說產線繼續把資料寫進 Google Drive；GitHub Actions 只負責把發布包同步成同站 `data/` 快照並部署 GitHub Pages。瀏覽器每 20 分鐘顯示倒數並檢查新 sequence。

## 已做好的功能

- 完整小說閱讀器，手機／桌機自適應
- 字體小／中／大
- 今日選股：證據、風險、確認訊號、失效條件、退出邏輯
- **選股歷程**：新增／升評／降評／定位調整／汰換／維持
- 選股歷程保留「為什麼增加、為什麼汰換」
- 原始 `selection_changes` 優先；舊資料只能用快照差異時會明確標「自動差異整理」
- 交易帳本
- 市場即時／ABC 波段：大盤、FX、跨資產、情境、支撐壓力、風險
- 人物誌：手動人物資料 + 章節出場索引
- 歷史資料與 Sheet 快照
- 每 20 分鐘倒數、自動資料檢查、失敗保留上一版
- GitHub Actions 自 Drive 同步與 GitHub Pages 部署

## 資料流

```text
小說排程 :05 / :25 / :45
        ↓
Google Drive 發布包
  manifest.json
  feed.index.json
  chapters / stocks / visuals
  market-intel / market.index.json
        ↓
GitHub Actions :07 / :27 / :47
        ↓
scripts/sync_drive.py
        ↓
repo/data/*
        ↓
GitHub Pages
        ↓
瀏覽器 :08 / :28 / :48 檢查新 sequence
（若還沒部署完成，每 30 秒重試，最多 8 次）
```

這樣 Work 額度耗盡、Work 專案故障或 Work 暫時不可用，都不會阻塞小說資料本身。

## 第一次部署

### 1. 建 GitHub repo

建立一個空 repo，例如：

`xiaozhi-stock-novel`

解壓本專案後：

```bash
git init
git add .
git commit -m "init static novel site"
git branch -M main
git remote add origin https://github.com/YOUR_ACCOUNT/xiaozhi-stock-novel.git
git push -u origin main
```

### 2. GitHub Pages

Repo → **Settings → Pages → Source → GitHub Actions**。

### 3. Drive 權限（建議 Service Account）

若發布包所有檔案都設定成「知道連結的任何人可檢視」，可以先不設 Secret。

更穩的方式：

1. Google Cloud 建立 project。
2. 啟用 Google Drive API。
3. 建立 Service Account，下載 JSON key。
4. 把 Drive 的「小智股海發財記/發布包」資料夾分享給 Service Account email，權限 Viewer。
5. 固定股票 Sheet 也分享 Viewer（如果要網站同步五張 Sheet）。
6. GitHub Repo → Settings → Secrets and variables → Actions。
7. 新增 Repository secret：`GDRIVE_SERVICE_ACCOUNT_JSON`
8. Value 貼完整 JSON key 內容。

**不要把 service-account.json commit 到 repo。**

### 4. 第一次同步

Actions → `Sync Drive & Deploy Pages` → `Run workflow`。

第一次會回補：

- `feed.index.json`
- 已有 file ID 的所有章節
- 2026-08-18 history archive，並拆成每回獨立 MD
- stocks JSON
- market SVG
- market-intel JSON/SVG
- 可讀取時的固定 Sheet 五表

## 自動刷新不是暴力 reload

瀏覽器會在 `:08 / :28 / :48` 進行資料檢查。

如果 manifest sequence 增加：
- 正在看「最新一回」→ 自動開新章
- 正在讀舊章 → 不把你踢走，只更新其他資料
- manifest 尚未更新 → 每 30 秒重試，避免 GitHub Actions 晚一分鐘就要再等 20 分鐘

可在 `config/site.json` 改：

```json
{
  "browserRefreshMinutes": [8, 28, 48],
  "refreshRetrySeconds": 30,
  "refreshRetryCount": 8
}
```

## 選股歷程的資料規則

網站**不刪除舊選股判斷**。

`stock-history.json` 由每回 `stocks/*.stocks.json` 自動聚合。若未來 stocks JSON 提供：

```json
{
  "selection_changes": [
    {
      "ticker": "4576",
      "action": "升評",
      "reason": "盤中量價轉強＋運控族群三檔共振＋官方新訂單證據"
    }
  ]
}
```

網站會標成 **原始理由**。

如果沒有 `selection_changes`，同步器才比較前後快照：
- 首次出現 → 新增
- rating 上升 → 升評
- rating 下降 → 降評
- positioning 改變 → 定位調整
- 從下一份清單消失 → 汰換
- 其餘 → 維持

這些事件會標 **自動差異整理**。尤其舊資料的「汰換」，若原始 JSON 沒有寫理由，網站只會顯示最後已知失效條件，不會假造原因。

詳細格式見 `docs/STOCK_HISTORY_SCHEMA.md`。

## 固定資料 ID

目前已放在 `config/site.json`：

- manifest：`1G9gV7jxXX9O0pYKk04_YSMLlLZeVcY6I`
- feed.index：`12UPvdDpqJOrC5U3betClok8eJKdPfgIR`
- market.index：`1BMekX0igi1jViPiz0uGScn7NTx0_vdkT`
- 股票 Sheet：`1-Qw9UQTq7dNzQn9NNx2qxEqpqWRuR0jPaCKSoTTM2Pc`
- 2026-08-18 chapter archive：`1DBtNXys0ufIvenroHAdhm4IPWDc_A_2o`

除非你未來真的換母本／索引檔，否則不用動。

## 本機預覽

不要直接雙擊 `index.html`，瀏覽器的 file:// 會限制 fetch。

```bash
python -m http.server 8000
```

開：

`http://localhost:8000`

## 靜態網站平常會不會耗 Work？

不會。

日常路徑是：

**Google Drive → GitHub Actions → GitHub Pages → 瀏覽器**

Work 只在你日後真的要改 UI、加功能、修 bug 時再使用。


## GitHub Actions 用量提醒

目前同步頻率是每小時三次（:07/:27/:47）。GitHub Actions 的可用分鐘與計費規則依你的 GitHub 帳號與 repo 類型而定，部署前請以 GitHub 當下顯示的方案額度為準。這套同步不會使用 ChatGPT Work 的網站修改流程。
