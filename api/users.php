<?php
require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// ユーザー情報更新
if ($method === 'PUT' && $action === 'profile') {
    if (!isLoggedIn()) {
        jsonResponse(['error' => 'Login required'], 401);
    }
    
    $data = getJsonInput();
    
    if (!isset($data['name']) || empty(trim($data['name']))) {
        jsonResponse(['error' => 'Name is required'], 400);
    }
    
    if (!isset($data['email']) || empty(trim($data['email']))) {
        jsonResponse(['error' => 'Email is required'], 400);
    }
    
    if (!isset($data['department_id']) || empty($data['department_id'])) {
        jsonResponse(['error' => 'Department is required'], 400);
    }
    
    $name = trim($data['name']);
    $email = trim($data['email']);
    $department_id = $data['department_id'];
    $email_notification = $data['email_notification'] ?? false;
    
    $pdo = getDB();
    
    try {
        // メールアドレスの重複チェック（自分以外）
        $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ? AND id != ?");
        $stmt->execute([$email, $_SESSION['user_id']]);
        if ($stmt->fetch()) {
            jsonResponse(['error' => 'Email already exists'], 409);
        }
        
        // 部署の存在確認
        $stmt = $pdo->prepare("SELECT id FROM departments WHERE id = ?");
        $stmt->execute([$department_id]);
        if (!$stmt->fetch()) {
            jsonResponse(['error' => 'Invalid department'], 400);
        }
        
        $stmt = $pdo->prepare("
            UPDATE users 
            SET name = ?, email = ?, department_id = ?, email_notification = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ");
        $stmt->execute([$name, $email, $department_id, $email_notification, $_SESSION['user_id']]);
        
        // 更新されたユーザー情報を取得
        $stmt = $pdo->prepare("
            SELECT u.*, d.name as department_name 
            FROM users u 
            JOIN departments d ON u.department_id = d.id 
            WHERE u.id = ?
        ");
        $stmt->execute([$_SESSION['user_id']]);
        $user = $stmt->fetch();
        
        unset($user['password']);
        
        jsonResponse([
            'message' => 'Profile updated successfully',
            'user' => $user
        ]);
        
    } catch (PDOException $e) {
        jsonResponse(['error' => 'Database error: ' . $e->getMessage()], 500);
    }
}

// パスワード変更
if ($method === 'PUT' && $action === 'password') {
    if (!isLoggedIn()) {
        jsonResponse(['error' => 'Login required'], 401);
    }
    
    $data = getJsonInput();
    
    if (!isset($data['current_password']) || !isset($data['new_password'])) {
        jsonResponse(['error' => 'Current password and new password are required'], 400);
    }
    
    $current_password = $data['current_password'];
    $new_password = $data['new_password'];
    
    if (strlen($new_password) < 6) {
        jsonResponse(['error' => 'New password must be at least 6 characters'], 400);
    }
    
    $pdo = getDB();
    
    try {
        // 現在のパスワードを確認
        $stmt = $pdo->prepare("SELECT password FROM users WHERE id = ?");
        $stmt->execute([$_SESSION['user_id']]);
        $user = $stmt->fetch();
        
        if (!$user || !verifyPassword($current_password, $user['password'])) {
            jsonResponse(['error' => 'Current password is incorrect'], 400);
        }
        
        $new_password_hash = hashPassword($new_password);
        
        $stmt = $pdo->prepare("UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
        $stmt->execute([$new_password_hash, $_SESSION['user_id']]);
        
        jsonResponse(['message' => 'Password updated successfully']);
        
    } catch (PDOException $e) {
        jsonResponse(['error' => 'Database error: ' . $e->getMessage()], 500);
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

// ユーザー一覧取得（管理者のみ）
if ($method === 'GET') {
    if (!isAdmin()) {
        jsonResponse(['error' => 'Admin access required'], 403);
    }
    
    $pdo = getDB();
    $stmt = $pdo->prepare("
        SELECT u.id, u.name, u.email, u.admin, u.email_notification, u.created_at, d.name as department_name
        FROM users u
        JOIN departments d ON u.department_id = d.id
        ORDER BY u.name ASC
    ");
    $stmt->execute();
    $users = $stmt->fetchAll();
    
    jsonResponse(['users' => $users]);
}

// 新規ユーザー作成（管理者のみ）
if ($method === 'POST') {
    if (!isAdmin()) {
        jsonResponse(['error' => 'Admin access required'], 403);
    }
    
    $data = getJsonInput();
    
    $required_fields = ['name', 'email', 'password', 'department_id'];
    foreach ($required_fields as $field) {
        if (!isset($data[$field]) || empty(trim($data[$field]))) {
            jsonResponse(['error' => ucfirst($field) . ' is required'], 400);
        }
    }
    
    $name = trim($data['name']);
    $email = trim($data['email']);
    $password = $data['password'];
    $department_id = $data['department_id'];
    $admin = $data['admin'] ?? false;
    $email_notification = $data['email_notification'] ?? false;
    
    if (strlen($password) < 6) {
        jsonResponse(['error' => 'Password must be at least 6 characters'], 400);
    }
    
    $pdo = getDB();
    
    try {
        // 部署の存在確認
        $stmt = $pdo->prepare("SELECT id FROM departments WHERE id = ?");
        $stmt->execute([$department_id]);
        if (!$stmt->fetch()) {
            jsonResponse(['error' => 'Invalid department'], 400);
        }
        
        $password_hash = hashPassword($password);
        
        $stmt = $pdo->prepare("
            INSERT INTO users (name, email, password, admin, department_id, email_notification)
            VALUES (?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([$name, $email, $password_hash, $admin, $department_id, $email_notification]);
        
        $user_id = $pdo->lastInsertId();
        
        // 作成されたユーザー情報を取得
        $stmt = $pdo->prepare("
            SELECT u.id, u.name, u.email, u.admin, u.email_notification, u.created_at, d.name as department_name
            FROM users u
            JOIN departments d ON u.department_id = d.id
            WHERE u.id = ?
        ");
        $stmt->execute([$user_id]);
        $user = $stmt->fetch();
        
        jsonResponse([
            'message' => 'User created successfully',
            'user' => $user
        ], 201);
        
    } catch (PDOException $e) {
        if ($e->errorInfo[1] === 19) { // UNIQUE constraint failed
            jsonResponse(['error' => 'Email already exists'], 409);
        }
        jsonResponse(['error' => 'Database error: ' . $e->getMessage()], 500);
    }
}

jsonResponse(['error' => 'Endpoint not found'], 404);
?>