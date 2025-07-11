# 週間表示の修正

下記を参考に現在時刻ラインを作成

```
// 現在時刻ラインを作成
function createCurrentTimeLine() {
    const now = getJapanTime();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();

    // 営業時間外の場合は表示しない
    if (currentHours < 9 || currentHours >= 18) {
        return null;
    }

    // 現在時刻を15分単位に調整
    const totalMinutes = (currentHours - 9) * 60 + currentMinutes;
    const slotIndex = Math.floor(totalMinutes / 15);
    const slotOffset = (totalMinutes % 15) / 15;

    // 動的なセル高さを取得
    const cellHeight = getWeekTimeHeaderHeight();

    // 位置を計算（cellHeight per slot + offset）
    const position = slotIndex * cellHeight + (slotOffset * cellHeight);

    return `<div class="current-time-line" style="top: ${position}px;">
                <div class="current-time-marker"></div>
            </div>`;
}
```



## 修正完了時の作業:false
trueなら以下の作業を実行してください。
`.claude/` フォルダに解説MDファイルを作成してください。