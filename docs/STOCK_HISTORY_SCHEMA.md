# 選股歷程資料契約

## 目標

每日選股不是只保留「最後清單」，而是保留完整決策過程：

- 為什麼新增
- 為什麼升評
- 為什麼降評
- 為什麼汰換
- 為什麼維持
- 當時證據
- 當時風險
- 確認訊號
- 失效條件
- 退出邏輯
- 是否真的成交

## 建議 stocks JSON 新增 `selection_changes`

```json
{
  "update_id": "UYYYYMMDD-HHMM",
  "selection_changes": [
    {
      "ticker": "4576",
      "name": "大銀微系統",
      "action": "升評",
      "from_rating": "B+",
      "to_rating": "A-",
      "reason": "新證據與族群共振同時成立",
      "evidence_added": ["..."],
      "risk_changed": ["..."],
      "market_id": "MYYYYMMDD-HHMM"
    }
  ]
}
```

`action` 建議固定：

`新增 | 維持 | 升評 | 降評 | 定位調整 | 汰換 | 撤回`

## 舊資料

舊 stocks JSON 沒有 selection_changes 時，`scripts/sync_drive.py` 會用快照差異產生事件。

所有自動產生的理由都會標：

`reason_source = auto_diff`

明確原始事件則標：

`reason_source = explicit`

網站絕不把 auto_diff 偽裝成原始人工判斷。
