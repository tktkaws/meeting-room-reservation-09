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

jsonResponse(['error' => 'Endpoint not found'], 404);
?>