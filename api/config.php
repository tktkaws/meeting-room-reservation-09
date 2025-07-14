<?php
// エラーレポートを有効にする（開発環境用）
error_reporting(E_ALL);
ini_set('display_errors', 0); // JSONレスポンスを保護するため無効化
ini_set('log_errors', 1);

// データベース設定
define('DB_PATH', dirname(__DIR__) . '/database/meeting-room-reservation.db');

// データベース接続
function getDB() {
    try {
        $pdo = new PDO('sqlite:' . DB_PATH);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        return $pdo;
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed: ' . $e->getMessage()]);
        exit;
    }
}

// JSONレスポンスを返す関数
function jsonResponse($data, $status = 200) {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

// リクエストメソッドをチェックする関数
function checkMethod($method) {
    if ($_SERVER['REQUEST_METHOD'] !== $method) {
        jsonResponse(['error' => 'Method not allowed'], 405);
    }
}

// JSONデータを取得する関数
function getJsonInput() {
    $json = file_get_contents('php://input');
    $data = json_decode($json, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        jsonResponse(['error' => 'Invalid JSON'], 400);
    }
    return $data;
}

// パスワードをハッシュ化する関数
function hashPassword($password) {
    return password_hash($password, PASSWORD_DEFAULT);
}

// パスワードを検証する関数
function verifyPassword($password, $hash) {
    return password_verify($password, $hash);
}

// セッション開始
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// ログイン状態をチェックする関数
function isLoggedIn() {
    return isset($_SESSION['user_id']);
}

// 管理者権限をチェックする関数
function isAdmin() {
    return isset($_SESSION['admin']) && (bool)$_SESSION['admin'];
}

// ユーザー情報を取得する関数
function getCurrentUser() {
    if (!isLoggedIn()) {
        return null;
    }
    
    $pdo = getDB();
    $stmt = $pdo->prepare("
        SELECT u.*, d.name as department_name 
        FROM users u 
        JOIN departments d ON u.department_id = d.id 
        WHERE u.id = ?
    ");
    $stmt->execute([$_SESSION['user_id']]);
    return $stmt->fetch();
}

// メール送信関数（基本実装）
function sendEmail($to, $subject, $message) {
    // 実際のメール送信処理
    // イントラネット用の簡単な実装
    $headers = "From: system@company.com\r\n";
    $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
    
    return mail($to, $subject, $message, $headers);
}

// 日付バリデーション関数
function validateBusinessHours($datetime) {
    $date = new DateTime($datetime);
    $dayOfWeek = $date->format('N'); // 1=月曜日, 7=日曜日
    $hour = $date->format('H');
    $minute = $date->format('i');
    
    // 土日チェック（土曜日=6, 日曜日=7）
    if ($dayOfWeek >= 6) {
        return false;
    }
    
    // 9時から18時までのチェック（18時00分は許可）
    if ($hour < 9 || $hour > 18) {
        return false;
    }
    
    // 18時の場合は00分のみ許可
    if ($hour === 18 && $minute !== 0) {
        return false;
    }
    
    // 15分単位チェック
    if ($minute % 15 !== 0) {
        return false;
    }
    
    return true;
}

// 開始時刻バリデーション関数
function validateStartTime($datetime) {
    $date = new DateTime($datetime);
    $dayOfWeek = $date->format('N'); // 1=月曜日, 7=日曜日
    $hour = $date->format('H');
    $minute = $date->format('i');
    
    // 土日チェック（土曜日=6, 日曜日=7）
    if ($dayOfWeek >= 6) {
        return false;
    }
    
    // 9時から17時59分までのチェック（開始時刻は18時開始不可）
    if ($hour < 9 || $hour >= 18) {
        return false;
    }
    
    // 15分単位チェック
    if ($minute % 15 !== 0) {
        return false;
    }
    
    return true;
}

// 終了時刻バリデーション関数
function validateEndTime($datetime) {
    $date = new DateTime($datetime);
    $dayOfWeek = $date->format('N'); // 1=月曜日, 7=日曜日
    $hour = $date->format('H');
    $minute = $date->format('i');
    
    // 土日チェック（土曜日=6, 日曜日=7）
    if ($dayOfWeek >= 6) {
        return false;
    }
    
    // 9時15分から18時00分までのチェック（終了時刻は18時00分まで可）
    if ($hour < 9 || $hour > 18) {
        return false;
    }
    
    // 18時00分の場合は分が00分でなければならない
    if ($hour === 18 && $minute !== 0) {
        return false;
    }
    
    // 9時00分終了は不可（最低15分の予約時間が必要）
    if ($hour === 9 && $minute === 0) {
        return false;
    }
    
    // 15分単位チェック
    if ($minute % 15 !== 0) {
        return false;
    }
    
    return true;
}

// 土日チェック専用関数
function validateWeekday($date) {
    $dateObj = new DateTime($date);
    $dayOfWeek = $dateObj->format('N'); // 1=月曜日, 7=日曜日
    return $dayOfWeek <= 5; // 月曜日から金曜日のみ
}

// 予約時間の重複チェック
function checkReservationConflict($start_datetime, $end_datetime, $exclude_id = null) {
    $pdo = getDB();
    
    // 正しい重複検出ロジック：
    // 新規予約の開始時刻が既存予約の終了時刻より前かつ、
    // 新規予約の終了時刻が既存予約の開始時刻より後の場合に重複
    $sql = "
        SELECT id FROM reservations 
        WHERE start_datetime < ? AND end_datetime > ?
    ";
    
    $params = [$end_datetime, $start_datetime];
    
    if ($exclude_id) {
        $sql .= " AND id != ?";
        $params[] = $exclude_id;
    }
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    
    return $stmt->fetch() !== false;
}

// CORS設定
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}
?>