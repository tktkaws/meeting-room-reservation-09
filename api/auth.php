<?php
require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// ログイン処理
if ($method === 'POST' && $action === 'login') {
    $data = getJsonInput();
    
    if (!isset($data['email']) || !isset($data['password'])) {
        jsonResponse(['error' => 'Email and password are required'], 400);
    }
    
    $pdo = getDB();
    $stmt = $pdo->prepare("
        SELECT u.*, d.name as department_name 
        FROM users u 
        JOIN departments d ON u.department_id = d.id 
        WHERE u.email = ?
    ");
    $stmt->execute([$data['email']]);
    $user = $stmt->fetch();
    
    if (!$user || !verifyPassword($data['password'], $user['password'])) {
        jsonResponse(['error' => 'Invalid credentials'], 401);
    }
    
    // セッションに保存
    $_SESSION['user_id'] = $user['id'];
    $_SESSION['admin'] = (bool)$user['admin'];
    
    // パスワードは返さない
    unset($user['password']);
    
    jsonResponse([
        'message' => 'Login successful',
        'user' => $user
    ]);
}

// ログアウト処理
if ($method === 'POST' && $action === 'logout') {
    session_destroy();
    jsonResponse(['message' => 'Logout successful']);
}

// 現在のユーザー情報取得
if ($method === 'GET' && $action === 'me') {
    $user = getCurrentUser();
    if (!$user) {
        jsonResponse(['error' => 'Not logged in'], 401);
    }
    
    unset($user['password']);
    jsonResponse(['user' => $user]);
}

// セッション状態確認
if ($method === 'GET' && $action === 'status') {
    $user = getCurrentUser();
    jsonResponse([
        'loggedIn' => isLoggedIn(),
        'admin' => isAdmin(),
        'user' => $user
    ]);
}

// 新規登録処理
if ($method === 'POST' && $action === 'signup') {
    $data = getJsonInput();
    
    // 必須項目チェック
    if (!isset($data['name']) || !isset($data['email']) || !isset($data['password']) || !isset($data['department_id'])) {
        jsonResponse(['error' => '名前、メールアドレス、パスワード、部署は必須です'], 400);
    }
    
    // パスワード確認
    if (isset($data['password_confirm']) && $data['password'] !== $data['password_confirm']) {
        jsonResponse(['error' => 'パスワードと確認パスワードが一致しません'], 400);
    }
    
    $pdo = getDB();
    
    // メールアドレスの重複チェック
    $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
    $stmt->execute([$data['email']]);
    if ($stmt->fetch()) {
        jsonResponse(['error' => 'このメールアドレスは既に使用されています'], 400);
    }
    
    // 部署の存在チェック
    $stmt = $pdo->prepare("SELECT id FROM departments WHERE id = ?");
    $stmt->execute([$data['department_id']]);
    if (!$stmt->fetch()) {
        jsonResponse(['error' => '指定された部署が存在しません'], 400);
    }
    
    try {
        // ユーザー登録
        $stmt = $pdo->prepare("
            INSERT INTO users (name, email, password, department_id, email_notification, admin, created_at) 
            VALUES (?, ?, ?, ?, ?, 0, datetime('now'))
        ");
        $stmt->execute([
            $data['name'],
            $data['email'],
            hashPassword($data['password']),
            $data['department_id'],
            isset($data['email_notification']) ? ($data['email_notification'] ? 1 : 0) : 1
        ]);
        
        $userId = $pdo->lastInsertId();
        
        // 登録したユーザー情報を取得
        $stmt = $pdo->prepare("
            SELECT u.*, d.name as department_name 
            FROM users u 
            JOIN departments d ON u.department_id = d.id 
            WHERE u.id = ?
        ");
        $stmt->execute([$userId]);
        $user = $stmt->fetch();
        
        // パスワードは返さない
        unset($user['password']);
        
        jsonResponse([
            'message' => '新規登録が完了しました',
            'user' => $user
        ]);
        
    } catch (PDOException $e) {
        jsonResponse(['error' => 'ユーザー登録に失敗しました: ' . $e->getMessage()], 500);
    }
}

jsonResponse(['error' => 'Endpoint not found'], 404);
?>