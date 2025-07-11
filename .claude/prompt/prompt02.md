# 予約CRUDの修正

## 予約フォームを修正
### 開始時間と終了時間の選択方法を変更
下記を参照

```
<div class="form-group">
                        <label for="reservation-start-hour">開始時刻 <span class="required">*</span></label>
                        <div class="time-select-group">
                            <select id="reservation-start-hour" name="start_hour" required>
                                <option value="9" selected>9</option>
                                <option value="10">10</option>
                                <option value="11">11</option>
                                <option value="12">12</option>
                                <option value="13">13</option>
                                <option value="14">14</option>
                                <option value="15">15</option>
                                <option value="16">16</option>
                                <option value="17">17</option>
                            </select>
                            <span class="time-separator">時</span>
                            <select id="reservation-start-minute" name="start_minute" required>
                                <option value="0" selected>00</option>
                                <option value="15">15</option>
                                <option value="30">30</option>
                                <option value="45">45</option>
                            </select>
                            <span class="time-separator">分</span>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="reservation-end-hour">終了時刻 <span class="required">*</span></label>
                        <div class="time-select-group">
                            <select id="reservation-end-hour" name="end_hour" required>
                                <option value="9">9</option>
                                <option value="10" selected>10</option>
                                <option value="11">11</option>
                                <option value="12">12</option>
                                <option value="13">13</option>
                                <option value="14">14</option>
                                <option value="15">15</option>
                                <option value="16">16</option>
                                <option value="17">17</option>
                                <option value="18">18</option>
                            </select>
                            <span class="time-separator">時</span>
                            <select id="reservation-end-minute" name="end_minute" required>
                                <option value="0" selected>00</option>
                                <option value="15">15</option>
                                <option value="30">30</option>
                                <option value="45">45</option>
                            </select>
                            <span class="time-separator">分</span>
                        </div>
                    </div>
```
### 日本時間に変更
新規予約ボタンを押した時、
月間ビューの日付セルを押した時に
新規予約フォームの開始時間を現在時間でセット
日本時間を取得して15分単位で丸める

週間ビューのセルをクリックしたときの取得時間も日本時間に変更



## 修正完了時の作業:true
trueなら以下の作業を実行してください。
`.claude/` フォルダに解説MDファイルを作成してください。