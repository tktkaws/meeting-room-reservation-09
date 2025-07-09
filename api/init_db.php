<?php
require_once 'config.php';

// データベース初期化
function initializeDatabase() {
    $pdo = getDB();
    
    // SQLファイルを読み込んで実行
    $sql = file_get_contents(dirname(__DIR__) . '/database/meeting-room-reservation.sql');
    
    try {
        $pdo->exec($sql);
        echo "テーブルが作成されました。\n";
    } catch (PDOException $e) {
        echo "テーブル作成エラー: " . $e->getMessage() . "\n";
    }
    
    // 初期部署データの投入
    $departments = [
        [1, '総務部', '#FF6B6B', 1],
        [2, '営業部', '#4ECDC4', 2],
        [3, '開発部', '#45B7D1', 3],
        [4, '人事部', '#96CEB4', 4],
        [5, '経理部', '#FFEAA7', 5]
    ];
    
    $stmt = $pdo->prepare("INSERT OR REPLACE INTO departments (id, name, default_color, display_order) VALUES (?, ?, ?, ?)");
    foreach ($departments as $dept) {
        $stmt->execute($dept);
    }
    echo "初期部署データが投入されました。\n";
    
    // 管理者ユーザーの作成
    $adminEmail = 'admin@company.com';
    $adminPassword = hashPassword('admin123');
    
    $stmt = $pdo->prepare("INSERT OR REPLACE INTO users (id, name, email, password, admin, department_id, email_notification) VALUES (?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute([1, '管理者', $adminEmail, $adminPassword, true, 1, false]);
    echo "管理者ユーザーが作成されました。\n";
    echo "ログイン情報: {$adminEmail} / admin123\n";
    
    // テストユーザーの作成
    $testUsers = [
        [2, '田中太郎', 'tanaka@company.com', hashPassword('test123'), false, 2, true],
        [3, '佐藤花子', 'sato@company.com', hashPassword('test123'), false, 3, true],
        [4, '鈴木次郎', 'suzuki@company.com', hashPassword('test123'), false, 4, false]
    ];
    
    foreach ($testUsers as $user) {
        $stmt->execute($user);
    }
    echo "テストユーザーが作成されました。\n";
}

// コマンドラインから実行された場合のみ初期化を実行
if (php_sapi_name() === 'cli') {
    initializeDatabase();
} else {
    // Web経由でのアクセスの場合は管理者権限チェック
    if (!isAdmin()) {
        jsonResponse(['error' => 'Unauthorized'], 401);
    }
    
    try {
        initializeDatabase();
        jsonResponse(['message' => 'Database initialized successfully']);
    } catch (Exception $e) {
        jsonResponse(['error' => 'Database initialization failed: ' . $e->getMessage()], 500);
    }
}
?>