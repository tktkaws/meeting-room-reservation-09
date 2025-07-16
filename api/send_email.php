<?php
require_once 'config.php';
require_once 'mail_template.php';

// POSTメソッドのみ許可
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'メソッドが許可されていません'], 405);
}

// ログイン確認
if (!isLoggedIn()) {
    jsonResponse(['error' => 'ログインが必要です'], 401);
}

$data = getJsonInput();

// 必須パラメータチェック
if (!isset($data['reservation_data']) || !isset($data['action'])) {
    jsonResponse(['error' => '予約データとアクションが必要です'], 400);
}

$reservationData = $data['reservation_data'];
$action = $data['action']; // 'created', 'updated', 'deleted'

// アクション値の検証
$allowedActions = ['created', 'updated', 'deleted'];
if (!in_array($action, $allowedActions)) {
    jsonResponse(['error' => '無効なアクションです'], 400);
}

try {
    writeEmailDebugLog("非同期メール送信開始", "INFO", [
        'action' => $action,
        'reservation_id' => $reservationData['id'] ?? 'unknown',
        'title' => $reservationData['title'] ?? ''
    ]);

    // アクションに応じてメール送信
    $result = false;
    if ($action === 'deleted') {
        $result = sendReservationEmailNotificationForDeleted($reservationData);
    } else {
        $result = sendReservationEmailNotification($reservationData, $action);
    }

    if ($result) {
        writeEmailDebugLog("非同期メール送信成功", "INFO", [
            'action' => $action,
            'reservation_id' => $reservationData['id'] ?? 'unknown'
        ]);
        jsonResponse(['message' => 'メール送信が完了しました']);
    } else {
        writeEmailDebugLog("非同期メール送信失敗", "ERROR", [
            'action' => $action,
            'reservation_id' => $reservationData['id'] ?? 'unknown'
        ]);
        jsonResponse(['error' => 'メール送信に失敗しました'], 500);
    }

} catch (Exception $e) {
    writeEmailDebugLog("非同期メール送信エラー", "ERROR", [
        'error_message' => $e->getMessage(),
        'action' => $action,
        'reservation_id' => $reservationData['id'] ?? 'unknown',
        'file' => $e->getFile(),
        'line' => $e->getLine()
    ]);
    
    error_log("非同期メール送信エラー: " . $e->getMessage());
    jsonResponse(['error' => 'メール送信中にエラーが発生しました'], 500);
}
?>