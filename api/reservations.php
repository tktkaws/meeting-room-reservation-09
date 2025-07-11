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
        SELECT r.*, u.name as user_name, u.department_id, d.name as department_name, d.default_color
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
        jsonResponse(['error' => 'ログインが必要です'], 401);
    }
    
    $data = getJsonInput();
    error_log('受信データ: ' . print_r($data, true)); // デバッグ用
    
    // バリデーション
    $required_fields = ['title', 'date', 'start_datetime', 'end_datetime'];
    foreach ($required_fields as $field) {
        if (!isset($data[$field]) || empty(trim($data[$field]))) {
            $field_names = ['title' => 'タイトル', 'date' => '日付', 'start_datetime' => '開始時刻', 'end_datetime' => '終了時刻'];
            $field_name = $field_names[$field] ?? $field;
            jsonResponse(['error' => $field_name . 'は必須です'], 400);
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
        jsonResponse(['error' => 'タイトルは50文字以内で入力してください'], 400);
    }
    
    // 詳細の文字数チェック
    if (mb_strlen($description) > 300) {
        jsonResponse(['error' => '詳細は300文字以内で入力してください'], 400);
    }
    
    // 土日チェック
    if (!validateWeekday($date)) {
        jsonResponse(['error' => '土日の予約はできません'], 400);
    }
    
    // 営業時間チェック
    if (!validateStartTime($start_datetime) || !validateEndTime($end_datetime)) {
        jsonResponse(['error' => '予約は平日の9:00-18:00の間で15分単位で行ってください'], 400);
    }
    
    // 時間の整合性チェック
    if (strtotime($start_datetime) >= strtotime($end_datetime)) {
        jsonResponse(['error' => '終了時刻は開始時刻より後に設定してください'], 400);
    }
    
    // 重複チェック
    if (checkReservationConflict($start_datetime, $end_datetime)) {
        jsonResponse(['error' => '指定の時間帯は既に予約されています'], 409);
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
            SELECT r.*, u.name as user_name, u.department_id, d.name as department_name, d.default_color
            FROM reservations r
            JOIN users u ON r.user_id = u.id
            JOIN departments d ON u.department_id = d.id
            WHERE r.id = ?
        ");
        $stmt->execute([$reservation_id]);
        $reservation = $stmt->fetch();
        
        // メール通知の送信（一時的に無効化）
        // sendReservationNotification('created', $reservation);
        
        jsonResponse([
            'message' => '予約を作成しました',
            'reservation' => $reservation
        ], 201);
        
    } catch (PDOException $e) {
        jsonResponse(['error' => 'データベースエラー: ' . $e->getMessage()], 500);
    }
}

// 予約更新
if ($method === 'PUT') {
    if (!isLoggedIn()) {
        jsonResponse(['error' => 'ログインが必要です'], 401);
    }
    
    $data = getJsonInput();
    
    if (!isset($data['id'])) {
        jsonResponse(['error' => '予約IDが必要です'], 400);
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
        jsonResponse(['error' => '予約が見つかりません'], 404);
    }
    
    $current_user = getCurrentUser();
    
    // 権限チェック：管理者は全ての予約を編集可能、一般ユーザーは作成者または同じ部署のみ
    if (!isAdmin()) {
        if ($existing_reservation['user_id'] != $current_user['id'] && 
            $existing_reservation['department_id'] != $current_user['department_id']) {
            jsonResponse(['error' => '権限がありません'], 403);
        }
    }
    
    // バリデーション（作成時と同じ）
    $required_fields = ['title', 'date', 'start_datetime', 'end_datetime'];
    foreach ($required_fields as $field) {
        if (!isset($data[$field]) || empty(trim($data[$field]))) {
            $field_names = ['title' => 'タイトル', 'date' => '日付', 'start_datetime' => '開始時刻', 'end_datetime' => '終了時刻'];
            $field_name = $field_names[$field] ?? $field;
            jsonResponse(['error' => $field_name . 'は必須です'], 400);
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
        jsonResponse(['error' => 'タイトルは50文字以内で入力してください'], 400);
    }
    
    if (mb_strlen($description) > 300) {
        jsonResponse(['error' => '詳細は300文字以内で入力してください'], 400);
    }
    
    // 土日チェック
    if (!validateWeekday($date)) {
        jsonResponse(['error' => '土日の予約はできません'], 400);
    }
    
    if (!validateStartTime($start_datetime) || !validateEndTime($end_datetime)) {
        jsonResponse(['error' => '予約は平日の9:00-18:00の間で15分単位で行ってください'], 400);
    }
    
    if (strtotime($start_datetime) >= strtotime($end_datetime)) {
        jsonResponse(['error' => '終了時刻は開始時刻より後に設定してください'], 400);
    }
    
    // 重複チェック（自分の予約は除外）
    if (checkReservationConflict($start_datetime, $end_datetime, $id)) {
        jsonResponse(['error' => '指定の時間帯は既に予約されています'], 409);
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
            SELECT r.*, u.name as user_name, u.department_id, d.name as department_name, d.default_color
            FROM reservations r
            JOIN users u ON r.user_id = u.id
            JOIN departments d ON u.department_id = d.id
            WHERE r.id = ?
        ");
        $stmt->execute([$id]);
        $reservation = $stmt->fetch();
        
        // メール通知の送信（一時的に無効化）
        // sendReservationNotification('updated', $reservation);
        
        jsonResponse([
            'message' => '予約を更新しました',
            'reservation' => $reservation
        ]);
        
    } catch (PDOException $e) {
        jsonResponse(['error' => 'データベースエラー: ' . $e->getMessage()], 500);
    }
}

// 予約削除
if ($method === 'DELETE') {
    if (!isLoggedIn()) {
        jsonResponse(['error' => 'ログインが必要です'], 401);
    }
    
    $data = getJsonInput();
    
    if (!isset($data['id'])) {
        jsonResponse(['error' => '予約IDが必要です'], 400);
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
        jsonResponse(['error' => '予約が見つかりません'], 404);
    }
    
    $current_user = getCurrentUser();
    
    // 権限チェック：管理者は全ての予約を削除可能、一般ユーザーは作成者または同じ部署のみ
    if (!isAdmin()) {
        if ($existing_reservation['user_id'] != $current_user['id'] && 
            $existing_reservation['department_id'] != $current_user['department_id']) {
            jsonResponse(['error' => '権限がありません'], 403);
        }
    }
    
    try {
        // 削除前に予約情報を取得（メール通知用）
        $stmt = $pdo->prepare("
            SELECT r.*, u.name as user_name, u.department_id, d.name as department_name, d.default_color
            FROM reservations r
            JOIN users u ON r.user_id = u.id
            JOIN departments d ON u.department_id = d.id
            WHERE r.id = ?
        ");
        $stmt->execute([$id]);
        $reservation = $stmt->fetch();
        
        $stmt = $pdo->prepare("DELETE FROM reservations WHERE id = ?");
        $stmt->execute([$id]);
        
        // メール通知の送信（一時的に無効化）
        // sendReservationNotification('deleted', $reservation);
        
        jsonResponse(['message' => '予約を削除しました']);
        
    } catch (PDOException $e) {
        jsonResponse(['error' => 'データベースエラー: ' . $e->getMessage()], 500);
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

jsonResponse(['error' => 'メソッドが許可されていません'], 405);
?>