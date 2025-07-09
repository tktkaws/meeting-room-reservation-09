<?php
require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];
$path = $_SERVER['REQUEST_URI'];

// 予約一覧取得
if ($method === 'GET') {
    $pdo = getDB();
    
    // クエリパラメータを取得
    $start_date = $_GET['start_date'] ?? null;
    $end_date = $_GET['end_date'] ?? null;
    $view_type = $_GET['view_type'] ?? 'month'; // month, week, list
    
    $sql = "
        SELECT r.*, u.name as user_name, d.name as department_name, d.default_color
        FROM reservations r
        JOIN users u ON r.user_id = u.id
        JOIN departments d ON u.department_id = d.id
    ";
    
    $params = [];
    $where_conditions = [];
    
    if ($start_date && $end_date) {
        $where_conditions[] = "r.date BETWEEN ? AND ?";
        $params[] = $start_date;
        $params[] = $end_date;
    } elseif ($view_type === 'list') {
        // リストビューの場合は今日以降の予約
        $where_conditions[] = "r.date >= DATE('now')";
    }
    
    if (!empty($where_conditions)) {
        $sql .= " WHERE " . implode(' AND ', $where_conditions);
    }
    
    $sql .= " ORDER BY r.date ASC, r.start_datetime ASC";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $reservations = $stmt->fetchAll();
    
    jsonResponse(['reservations' => $reservations]);
}

// 予約作成
if ($method === 'POST') {
    if (!isLoggedIn()) {
        jsonResponse(['error' => 'Login required'], 401);
    }
    
    $data = getJsonInput();
    
    // バリデーション
    $required_fields = ['title', 'date', 'start_datetime', 'end_datetime'];
    foreach ($required_fields as $field) {
        if (!isset($data[$field]) || empty(trim($data[$field]))) {
            jsonResponse(['error' => ucfirst($field) . ' is required'], 400);
        }
    }
    
    $title = trim($data['title']);
    $description = trim($data['description'] ?? '');
    $date = $data['date'];
    $start_datetime = $data['start_datetime'];
    $end_datetime = $data['end_datetime'];
    $is_company_wide = $data['is_company_wide'] ?? false;
    
    // タイトルの文字数チェック
    if (mb_strlen($title) > 50) {
        jsonResponse(['error' => 'Title must be 50 characters or less'], 400);
    }
    
    // 詳細の文字数チェック
    if (mb_strlen($description) > 300) {
        jsonResponse(['error' => 'Description must be 300 characters or less'], 400);
    }
    
    // 営業時間チェック
    if (!validateBusinessHours($start_datetime) || !validateBusinessHours($end_datetime)) {
        jsonResponse(['error' => 'Reservations must be between 9:00 AM and 6:00 PM on weekdays, in 15-minute intervals'], 400);
    }
    
    // 時間の整合性チェック
    if (strtotime($start_datetime) >= strtotime($end_datetime)) {
        jsonResponse(['error' => 'End time must be after start time'], 400);
    }
    
    // 重複チェック
    if (checkReservationConflict($start_datetime, $end_datetime)) {
        jsonResponse(['error' => 'Time slot is already reserved'], 409);
    }
    
    $pdo = getDB();
    
    try {
        $stmt = $pdo->prepare("
            INSERT INTO reservations (user_id, title, description, date, start_datetime, end_datetime, is_company_wide)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $_SESSION['user_id'],
            $title,
            $description,
            $date,
            $start_datetime,
            $end_datetime,
            $is_company_wide
        ]);
        
        $reservation_id = $pdo->lastInsertId();
        
        // 作成された予約情報を取得
        $stmt = $pdo->prepare("
            SELECT r.*, u.name as user_name, d.name as department_name, d.default_color
            FROM reservations r
            JOIN users u ON r.user_id = u.id
            JOIN departments d ON u.department_id = d.id
            WHERE r.id = ?
        ");
        $stmt->execute([$reservation_id]);
        $reservation = $stmt->fetch();
        
        // メール通知の送信
        sendReservationNotification('created', $reservation);
        
        jsonResponse([
            'message' => 'Reservation created successfully',
            'reservation' => $reservation
        ], 201);
        
    } catch (PDOException $e) {
        jsonResponse(['error' => 'Database error: ' . $e->getMessage()], 500);
    }
}

// 予約更新
if ($method === 'PUT') {
    if (!isLoggedIn()) {
        jsonResponse(['error' => 'Login required'], 401);
    }
    
    $data = getJsonInput();
    
    if (!isset($data['id'])) {
        jsonResponse(['error' => 'Reservation ID is required'], 400);
    }
    
    $id = $data['id'];
    $pdo = getDB();
    
    // 予約の存在確認と権限チェック
    $stmt = $pdo->prepare("
        SELECT r.*, u.department_id 
        FROM reservations r 
        JOIN users u ON r.user_id = u.id 
        WHERE r.id = ?
    ");
    $stmt->execute([$id]);
    $existing_reservation = $stmt->fetch();
    
    if (!$existing_reservation) {
        jsonResponse(['error' => 'Reservation not found'], 404);
    }
    
    $current_user = getCurrentUser();
    
    // 権限チェック：作成者、同じ部署のユーザー、または管理者のみ編集可能
    if ($existing_reservation['user_id'] != $current_user['id'] && 
        $existing_reservation['department_id'] != $current_user['department_id'] && 
        !isAdmin()) {
        jsonResponse(['error' => 'Permission denied'], 403);
    }
    
    // バリデーション（作成時と同じ）
    $required_fields = ['title', 'date', 'start_datetime', 'end_datetime'];
    foreach ($required_fields as $field) {
        if (!isset($data[$field]) || empty(trim($data[$field]))) {
            jsonResponse(['error' => ucfirst($field) . ' is required'], 400);
        }
    }
    
    $title = trim($data['title']);
    $description = trim($data['description'] ?? '');
    $date = $data['date'];
    $start_datetime = $data['start_datetime'];
    $end_datetime = $data['end_datetime'];
    $is_company_wide = $data['is_company_wide'] ?? false;
    
    // バリデーション
    if (mb_strlen($title) > 50) {
        jsonResponse(['error' => 'Title must be 50 characters or less'], 400);
    }
    
    if (mb_strlen($description) > 300) {
        jsonResponse(['error' => 'Description must be 300 characters or less'], 400);
    }
    
    if (!validateBusinessHours($start_datetime) || !validateBusinessHours($end_datetime)) {
        jsonResponse(['error' => 'Reservations must be between 9:00 AM and 6:00 PM on weekdays, in 15-minute intervals'], 400);
    }
    
    if (strtotime($start_datetime) >= strtotime($end_datetime)) {
        jsonResponse(['error' => 'End time must be after start time'], 400);
    }
    
    // 重複チェック（自分の予約は除外）
    if (checkReservationConflict($start_datetime, $end_datetime, $id)) {
        jsonResponse(['error' => 'Time slot is already reserved'], 409);
    }
    
    try {
        $stmt = $pdo->prepare("
            UPDATE reservations 
            SET title = ?, description = ?, date = ?, start_datetime = ?, end_datetime = ?, is_company_wide = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ");
        $stmt->execute([
            $title,
            $description,
            $date,
            $start_datetime,
            $end_datetime,
            $is_company_wide,
            $id
        ]);
        
        // 更新された予約情報を取得
        $stmt = $pdo->prepare("
            SELECT r.*, u.name as user_name, d.name as department_name, d.default_color
            FROM reservations r
            JOIN users u ON r.user_id = u.id
            JOIN departments d ON u.department_id = d.id
            WHERE r.id = ?
        ");
        $stmt->execute([$id]);
        $reservation = $stmt->fetch();
        
        // メール通知の送信
        sendReservationNotification('updated', $reservation);
        
        jsonResponse([
            'message' => 'Reservation updated successfully',
            'reservation' => $reservation
        ]);
        
    } catch (PDOException $e) {
        jsonResponse(['error' => 'Database error: ' . $e->getMessage()], 500);
    }
}

// 予約削除
if ($method === 'DELETE') {
    if (!isLoggedIn()) {
        jsonResponse(['error' => 'Login required'], 401);
    }
    
    $data = getJsonInput();
    
    if (!isset($data['id'])) {
        jsonResponse(['error' => 'Reservation ID is required'], 400);
    }
    
    $id = $data['id'];
    $pdo = getDB();
    
    // 予約の存在確認と権限チェック
    $stmt = $pdo->prepare("
        SELECT r.*, u.department_id 
        FROM reservations r 
        JOIN users u ON r.user_id = u.id 
        WHERE r.id = ?
    ");
    $stmt->execute([$id]);
    $existing_reservation = $stmt->fetch();
    
    if (!$existing_reservation) {
        jsonResponse(['error' => 'Reservation not found'], 404);
    }
    
    $current_user = getCurrentUser();
    
    // 権限チェック：作成者、同じ部署のユーザー、または管理者のみ削除可能
    if ($existing_reservation['user_id'] != $current_user['id'] && 
        $existing_reservation['department_id'] != $current_user['department_id'] && 
        !isAdmin()) {
        jsonResponse(['error' => 'Permission denied'], 403);
    }
    
    try {
        // 削除前に予約情報を取得（メール通知用）
        $stmt = $pdo->prepare("
            SELECT r.*, u.name as user_name, d.name as department_name, d.default_color
            FROM reservations r
            JOIN users u ON r.user_id = u.id
            JOIN departments d ON u.department_id = d.id
            WHERE r.id = ?
        ");
        $stmt->execute([$id]);
        $reservation = $stmt->fetch();
        
        $stmt = $pdo->prepare("DELETE FROM reservations WHERE id = ?");
        $stmt->execute([$id]);
        
        // メール通知の送信
        sendReservationNotification('deleted', $reservation);
        
        jsonResponse(['message' => 'Reservation deleted successfully']);
        
    } catch (PDOException $e) {
        jsonResponse(['error' => 'Database error: ' . $e->getMessage()], 500);
    }
}

// 予約通知メール送信関数
function sendReservationNotification($action, $reservation) {
    $pdo = getDB();
    
    // メール通知を希望するユーザーを取得
    $stmt = $pdo->prepare("SELECT email FROM users WHERE email_notification = 1");
    $stmt->execute();
    $recipients = $stmt->fetchAll();
    
    if (empty($recipients)) {
        return;
    }
    
    $action_text = [
        'created' => '作成',
        'updated' => '更新',
        'deleted' => '削除'
    ];
    
    $subject = "会議室予約が{$action_text[$action]}されました";
    $message = "
        <h2>会議室予約{$action_text[$action]}通知</h2>
        <p><strong>タイトル:</strong> {$reservation['title']}</p>
        <p><strong>日付:</strong> {$reservation['date']}</p>
        <p><strong>時間:</strong> " . date('H:i', strtotime($reservation['start_datetime'])) . " - " . date('H:i', strtotime($reservation['end_datetime'])) . "</p>
        <p><strong>予約者:</strong> {$reservation['user_name']} ({$reservation['department_name']})</p>
        <p><strong>詳細:</strong> {$reservation['description']}</p>
    ";
    
    foreach ($recipients as $recipient) {
        sendEmail($recipient['email'], $subject, $message);
    }
}

jsonResponse(['error' => 'Method not allowed'], 405);
?>