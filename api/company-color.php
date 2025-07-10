<?php
require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];

// 全社カラー設定取得
if ($method === 'GET') {
    try {
        $settingsFile = __DIR__ . '/../database/company_settings.json';
        
        if (file_exists($settingsFile)) {
            $settings = json_decode(file_get_contents($settingsFile), true);
            $color = $settings['default_color'] ?? '#718096';
        } else {
            $color = '#718096';
        }
        
        jsonResponse(['color' => $color]);
        
    } catch (Exception $e) {
        jsonResponse(['error' => 'File error: ' . $e->getMessage()], 500);
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
        $settingsFile = __DIR__ . '/../database/company_settings.json';
        
        // 既存の設定を読み込む
        $settings = [];
        if (file_exists($settingsFile)) {
            $settings = json_decode(file_get_contents($settingsFile), true) ?? [];
        }
        
        // 新しい設定を追加
        $settings['default_color'] = $color;
        $settings['updated_at'] = date('c');
        
        // JSONファイルに保存
        if (file_put_contents($settingsFile, json_encode($settings, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)) === false) {
            throw new Exception('Failed to save settings file');
        }
        
        jsonResponse([
            'message' => 'Company color saved successfully',
            'color' => $color
        ]);
        
    } catch (Exception $e) {
        jsonResponse(['error' => 'File error: ' . $e->getMessage()], 500);
    }
}

jsonResponse(['error' => 'Method not allowed'], 405);
?>