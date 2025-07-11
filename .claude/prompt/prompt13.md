# 予約データのcsvインポート



C:\Program Files\Ampps\www\meeting-room-reservation-09\database\db-admin.php

既存のインポートとは別に、構造の違うcsvからreservationテーブルにインポートする機能を作成

C:\Program Files\Ampps\www\meeting-room-reservation-09\database\csv\reserve_0710.csv
このファイルの構造からreservationテーブルにインポート

予約者名がuser_id
内容がタイトル

年	月	日	開始時	開始分	終了時	終了分
から必要なデータに整形して登録

## 修正完了時の作業:false
trueなら以下の作業を実行してください。
`.claude/` フォルダに解説MDファイルを作成してください。