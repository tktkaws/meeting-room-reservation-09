<?php
require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$id = $_GET['id'] ?? '';

// 管理者権限チェック
function requireAdmin() {
    if (!isLoggedIn() || !isAdmin()) {
        jsonResponse(['error' => 'Unauthorized'], 401);
    }
}

// ユーザー一覧取得
if ($method === 'GET' && empty($action)) {
    requireAdmin();
    
    $pdo = getDB();
    $stmt = $pdo->prepare("
        SELECT u.*, d.name as department_name 
        FROM users u 
        JOIN departments d ON u.department_id = d.id 
        ORDER BY u.created_at DESC
    ");
    $stmt->execute();
    $users = $stmt->fetchAll();
    
    // パスワードは返さない
    foreach ($users as &$user) {
        unset($user['password']);
    }
    
    jsonResponse(['users' => $users]);
}

// ユーザー更新
if ($method === 'PUT' && !empty($id)) {
    requireAdmin();
    
    $data = getJsonInput();
    
    if (!isset($data['name']) || !isset($data['email']) || !isset($data['department_id'])) {
        jsonResponse(['error' => '名前、メールアドレス、部署は必須です'], 400);
    }
    
    $pdo = getDB();
    
    // メールアドレスの重複チェック（自分以外）
    $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ? AND id != ?");
    $stmt->execute([$data['email'], $id]);
    if ($stmt->fetch()) {
        jsonResponse(['error' => 'このメールアドレスは既に使用されています'], 400);
    }
    
    try {
        $stmt = $pdo->prepare("
            UPDATE users 
            SET name = ?, email = ?, department_id = ?, email_notification = ?, admin = ?
            WHERE id = ?
        ");
        $stmt->execute([
            $data['name'],
            $data['email'],
            $data['department_id'],
            isset($data['email_notification']) ? ($data['email_notification'] ? 1 : 0) : 0,
            isset($data['admin']) ? ($data['admin'] ? 1 : 0) : 0,
            $id
        ]);
        
        jsonResponse(['message' => 'ユーザー情報を更新しました']);
        
    } catch (PDOException $e) {
        jsonResponse(['error' => 'ユーザー情報の更新に失敗しました: ' . $e->getMessage()], 500);
    }
}

// 一括編集
if ($method === 'POST' && $action === 'bulk_edit') {
    requireAdmin();
    
    $data = getJsonInput();
    
    if (!isset($data['user_ids']) || !isset($data['operation'])) {
        jsonResponse(['error' => 'ユーザーIDと操作が必要です'], 400);
    }
    
    $userIds = $data['user_ids'];
    $operation = $data['operation'];
    
    if (empty($userIds)) {
        jsonResponse(['error' => 'ユーザーを選択してください'], 400);
    }
    
    $pdo = getDB();
    
    try {
        $placeholders = str_repeat('?,', count($userIds) - 1) . '?';
        
        if ($operation === 'department') {
            if (!isset($data['department_id'])) {
                jsonResponse(['error' => '部署を選択してください'], 400);
            }
            
            $stmt = $pdo->prepare("UPDATE users SET department_id = ? WHERE id IN ($placeholders)");
            $stmt->execute(array_merge([$data['department_id']], $userIds));
            
        } elseif ($operation === 'email_notification') {
            if (!isset($data['email_notification'])) {
                jsonResponse(['error' => 'メール通知設定を選択してください'], 400);
            }
            
            $stmt = $pdo->prepare("UPDATE users SET email_notification = ? WHERE id IN ($placeholders)");
            $stmt->execute(array_merge([$data['email_notification'] ? 1 : 0], $userIds));
            
        } elseif ($operation === 'admin') {
            if (!isset($data['admin'])) {
                jsonResponse(['error' => '管理者権限を選択してください'], 400);
            }
            
            $stmt = $pdo->prepare("UPDATE users SET admin = ? WHERE id IN ($placeholders)");
            $stmt->execute(array_merge([$data['admin'] ? 1 : 0], $userIds));
            
        } else {
            jsonResponse(['error' => '無効な操作です'], 400);
        }
        
        jsonResponse(['message' => '一括編集が完了しました']);
        
    } catch (PDOException $e) {
        jsonResponse(['error' => '一括編集に失敗しました: ' . $e->getMessage()], 500);
    }
}

// 一括削除
if ($method === 'POST' && $action === 'bulk_delete') {
    requireAdmin();
    
    $data = getJsonInput();
    
    if (!isset($data['user_ids'])) {
        jsonResponse(['error' => 'ユーザーIDが必要です'], 400);
    }
    
    $userIds = $data['user_ids'];
    
    if (empty($userIds)) {
        jsonResponse(['error' => 'ユーザーを選択してください'], 400);
    }
    
    $pdo = getDB();
    
    try {
        $pdo->beginTransaction();
        
        $placeholders = str_repeat('?,', count($userIds) - 1) . '?';
        
        foreach ($userIds as $userId) {
            // 削除対象ユーザーの情報を取得
            $stmt = $pdo->prepare("SELECT department_id FROM users WHERE id = ?");
            $stmt->execute([$userId]);
            $user = $stmt->fetch();
            
            if (!$user) continue;
            
            // 該当ユーザーが作成した予約を取得
            $stmt = $pdo->prepare("SELECT id FROM reservations WHERE user_id = ?");
            $stmt->execute([$userId]);
            $reservations = $stmt->fetchAll();
            
            if (!empty($reservations)) {
                // 同じ部署の他のユーザーを探す
                $stmt = $pdo->prepare("SELECT id FROM users WHERE department_id = ? AND id != ? LIMIT 1");
                $stmt->execute([$user['department_id'], $userId]);
                $replacementUser = $stmt->fetch();
                
                if (!$replacementUser) {
                    // 同じ部署のユーザーがいない場合、管理者を探す
                    $stmt = $pdo->prepare("SELECT id FROM users WHERE admin = 1 AND id != ? LIMIT 1");
                    $stmt->execute([$userId]);
                    $replacementUser = $stmt->fetch();
                }
                
                if ($replacementUser) {
                    // 予約の作成者を変更
                    $reservationIds = array_column($reservations, 'id');
                    $reservationPlaceholders = str_repeat('?,', count($reservationIds) - 1) . '?';
                    $stmt = $pdo->prepare("UPDATE reservations SET user_id = ? WHERE id IN ($reservationPlaceholders)");
                    $stmt->execute(array_merge([$replacementUser['id']], $reservationIds));
                } else {
                    // 引き継ぎ先がない場合、予約を削除
                    $reservationIds = array_column($reservations, 'id');
                    $reservationPlaceholders = str_repeat('?,', count($reservationIds) - 1) . '?';
                    $stmt = $pdo->prepare("DELETE FROM reservations WHERE id IN ($reservationPlaceholders)");
                    $stmt->execute($reservationIds);
                }
            }
        }
        
        // ユーザーを削除
        $stmt = $pdo->prepare("DELETE FROM users WHERE id IN ($placeholders)");
        $stmt->execute($userIds);
        
        $pdo->commit();
        
        jsonResponse(['message' => '選択したユーザーを削除しました']);
        
    } catch (PDOException $e) {
        $pdo->rollBack();
        jsonResponse(['error' => 'ユーザー削除に失敗しました: ' . $e->getMessage()], 500);
    }
}

// カラー設定更新
if ($method === 'PUT' && $action === 'colors') {
    if (!isLoggedIn()) {
        jsonResponse(['error' => 'Login required'], 401);
    }
    
    $data = getJsonInput();
    
    if (!isset($data['color_settings'])) {
        jsonResponse(['error' => 'Color settings are required'], 400);
    }
    
    $color_settings = json_encode($data['color_settings']);
    
    $pdo = getDB();
    
    try {
        $stmt = $pdo->prepare("UPDATE users SET color_setting = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
        $stmt->execute([$color_settings, $_SESSION['user_id']]);
        
        jsonResponse(['message' => 'Color settings updated successfully']);
        
    } catch (PDOException $e) {
        jsonResponse(['error' => 'Database error: ' . $e->getMessage()], 500);
    }
}

jsonResponse(['error' => 'Endpoint not found'], 404);
?>