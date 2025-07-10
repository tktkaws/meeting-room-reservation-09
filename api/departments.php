<?php
require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];
$path = $_SERVER['REQUEST_URI'];

// 部署一覧取得
if ($method === 'GET') {
    $pdo = getDB();
    $stmt = $pdo->prepare("
        SELECT d.*, 
               COALESCE(u.user_count, 0) as user_count
        FROM departments d
        LEFT JOIN (
            SELECT department_id, COUNT(*) as user_count
            FROM users
            GROUP BY department_id
        ) u ON d.id = u.department_id
        ORDER BY d.display_order ASC, d.name ASC
    ");
    $stmt->execute();
    $departments = $stmt->fetchAll();
    
    jsonResponse(['departments' => $departments]);
}

// 部署追加
if ($method === 'POST') {
    if (!isAdmin()) {
        jsonResponse(['error' => 'Admin access required'], 403);
    }
    
    $data = getJsonInput();
    
    if (!isset($data['name']) || empty(trim($data['name']))) {
        jsonResponse(['error' => 'Department name is required'], 400);
    }
    
    $name = trim($data['name']);
    $default_color = $data['default_color'] ?? '#718096';
    $display_order = $data['display_order'] ?? 0;
    
    $pdo = getDB();
    
    try {
        $stmt = $pdo->prepare("INSERT INTO departments (name, default_color, display_order) VALUES (?, ?, ?)");
        $stmt->execute([$name, $default_color, $display_order]);
        
        $department_id = $pdo->lastInsertId();
        
        // 作成された部署情報を返す
        $stmt = $pdo->prepare("SELECT * FROM departments WHERE id = ?");
        $stmt->execute([$department_id]);
        $department = $stmt->fetch();
        
        jsonResponse([
            'message' => 'Department created successfully',
            'department' => $department
        ], 201);
        
    } catch (PDOException $e) {
        if ($e->errorInfo[1] === 19) { // UNIQUE constraint failed
            jsonResponse(['error' => 'Department name already exists'], 409);
        }
        jsonResponse(['error' => 'Database error: ' . $e->getMessage()], 500);
    }
}

// 部署更新
if ($method === 'PUT') {
    if (!isAdmin()) {
        jsonResponse(['error' => 'Admin access required'], 403);
    }
    
    $data = getJsonInput();
    
    if (!isset($data['id']) || !isset($data['name']) || empty(trim($data['name']))) {
        jsonResponse(['error' => 'Department ID and name are required'], 400);
    }
    
    $id = $data['id'];
    $name = trim($data['name']);
    $default_color = $data['default_color'] ?? '#718096';
    $display_order = $data['display_order'] ?? 0;
    
    $pdo = getDB();
    
    try {
        $stmt = $pdo->prepare("UPDATE departments SET name = ?, default_color = ?, display_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
        $stmt->execute([$name, $default_color, $display_order, $id]);
        
        if ($stmt->rowCount() === 0) {
            jsonResponse(['error' => 'Department not found'], 404);
        }
        
        // 更新された部署情報を返す
        $stmt = $pdo->prepare("SELECT * FROM departments WHERE id = ?");
        $stmt->execute([$id]);
        $department = $stmt->fetch();
        
        jsonResponse([
            'message' => 'Department updated successfully',
            'department' => $department
        ]);
        
    } catch (PDOException $e) {
        if ($e->errorInfo[1] === 19) { // UNIQUE constraint failed
            jsonResponse(['error' => 'Department name already exists'], 409);
        }
        jsonResponse(['error' => 'Database error: ' . $e->getMessage()], 500);
    }
}

// 部署削除
if ($method === 'DELETE') {
    if (!isAdmin()) {
        jsonResponse(['error' => 'Admin access required'], 403);
    }
    
    $data = getJsonInput();
    
    if (!isset($data['id'])) {
        jsonResponse(['error' => 'Department ID is required'], 400);
    }
    
    $id = $data['id'];
    $pdo = getDB();
    
    try {
        // 部署に所属するユーザーがいるかチェック
        $stmt = $pdo->prepare("SELECT COUNT(*) as count FROM users WHERE department_id = ?");
        $stmt->execute([$id]);
        $result = $stmt->fetch();
        
        if ($result['count'] > 0) {
            jsonResponse(['error' => 'Cannot delete department with existing users'], 409);
        }
        
        $stmt = $pdo->prepare("DELETE FROM departments WHERE id = ?");
        $stmt->execute([$id]);
        
        if ($stmt->rowCount() === 0) {
            jsonResponse(['error' => 'Department not found'], 404);
        }
        
        jsonResponse(['message' => 'Department deleted successfully']);
        
    } catch (PDOException $e) {
        jsonResponse(['error' => 'Database error: ' . $e->getMessage()], 500);
    }
}

jsonResponse(['error' => 'Method not allowed'], 405);
?>