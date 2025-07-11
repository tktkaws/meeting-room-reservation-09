# main-contentのレイアウトを変更

```
<main class="main-content">
            <div class="content-header">
                <button id="toggleSidebar" class="hamburger-btn">
                    <span class="bar"></span>
                    <span class="bar"></span>
                    <span class="bar"></span>
                </button>
                <div class="navigation">
                    <button id="todayBtn" class="today-btn">今日</button>
                    <button class="nav-btn" id="prevBtnMonth">&lt;</button>
                    <button class="nav-btn" id="nextBtnMonth">&gt;</button>
                    <span class="current-date" id="currentDateMonth"></span>
                </div>
                <div class="list-controls">
                    <button>今後の予定</button>
                    <button>過去の予定</button>
                </div>
                <div class="view-controls">
                    <button id="monthView" class="view-btn active">月間ビュー</button>
                    <button id="weekView" class="view-btn">週間ビュー</button>
                    <button id="listView" class="view-btn">リストビュー</button>
                </div>
            </div>
            <div id="calendar-container">
                <div id="monthCalendar" class="calendar-view"></div>
                <div id="weekCalendar" class="calendar-view" style="display: none;"></div>
                <div id="listCalendar" class="calendar-view" style="display: none;"></div>
            </div>
            <div class="action-buttons" id="actionButtons" style="display: none;">
                <button id="createReservationBtn">新規予約</button>
            </div>
        </main>
```
JSで描画していたものを変更
リスト表示のときはnavigationを非表示にするlist-controlsを表示

id="actionButtons"は画面右下にabsoluteで固定表示

toggleSidebarは画面幅1200px以下で表示
sidebarは1200oxで非表示　トグルで左から出てくる

## 修正完了時の作業:false
trueなら以下の作業を実行してください。
`.claude/` フォルダに解説MDファイルを作成してください。