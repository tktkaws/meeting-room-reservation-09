# cssのリファクタリング

## 作業
 - 使用していないクラスの記述は削除　コメントアウトも含む
 - 設定しているカラー、バックグラウンドをまとめる　変数にする　cssの最初に記述




## 修正完了時の作業:false
trueなら以下の作業を実行してください。
`.claude/` フォルダに解説MDファイルを作成してください。

```
:root {
    --primary-color: #3498db;
    --primary-hover-color: #2980b9;
    --danger-color: #e74c3c;
    --danger-hover-color: #c0392b;
    --warning-color: #f39c12;
    --warning-hover-color: #e67e22;
    --background-color: #F8FAFD;
    --text-color-main: #2c3e50;
    --text-color-light: #4A5568;
    --text-color-muted: #7f8c8d;
    --white-color: #fff;
    --border-color: #e2e8f0;
    --border-color-dark: #bdc3c7;
    --light-gray-bg: #f8f9fa;
    --medium-gray-bg: #ecf0f1;
    --medium-gray-hover-bg: #d5dbdb;
    --success-bg: #d4edda;
    --success-text: #155724;
    --success-border: #c3e6cb;
    --error-bg: #f8d7da;
    --error-text: #721c24;
    --error-border: #f5c6cb;

    --list-view-height: calc(100vh - 120px);
    --calendar-day-height: calc((var(--list-view-height) - 40px) / 5);
}
```