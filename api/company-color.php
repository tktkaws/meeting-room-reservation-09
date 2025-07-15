<?php
require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];

// 全社カラー設定取得
if ($method === 'GET') {
    try {
        $pdo = getDB();
        
        $stmt = $pdo->prepare("SELECT setting_value FROM company_settings WHERE setting_key = 'default_color'");
        $stmt->execute();
        $result = $stmt->fetchColumn();
        
        $color = $result ?: '#718096';
        
        jsonResponse(['color' => $color]);
        
    } catch (Exception $e) {
        jsonResponse(['error' => 'Database error: ' . $e->getMessage()], 500);
    }
}

// 全社カラー設定保存
if ($method === 'POST') {
    if (!isAdmin()) {
        jsonResponse(['error' => 'Admin access required'], 403);
    }
    
    $data = getJsonInput();
    
    if (!isset($data['color']) || !preg_match('/^#[0-9A-Fa-f]{6}$/', $data['color'])) {
        jsonResponse(['error' => 'Valid color code is required'], 400);
    }
    
    $color = $data['color'];
    
    try {
        $pdo = getDB();
        
        // company_settingsテーブルが存在するかチェック
        $stmt = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name='company_settings'");
        if (!$stmt->fetchColumn()) {
            // テーブルが存在しない場合は作成
            $createTableSQL = "
            CREATE TABLE company_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                setting_key TEXT UNIQUE NOT NULL,
                setting_value TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )";
            $pdo->exec($createTableSQL);
        }
        
        // default_colorの更新または挿入
        $stmt = $pdo->prepare("
            INSERT INTO company_settings (setting_key, setting_value) 
            VALUES ('default_color', ?)
            ON CONFLICT(setting_key) 
            DO UPDATE SET 
                setting_value = excluded.setting_value,
                updated_at = CURRENT_TIMESTAMP
        ");
        $stmt->execute([$color]);
        
        jsonResponse([
            'message' => 'Company color saved successfully',
            'color' => $color
        ]);
        
    } catch (Exception $e) {
        jsonResponse(['error' => 'Database error: ' . $e->getMessage()], 500);
    }
}

jsonResponse(['error' => 'Method not allowed'], 405);
?>