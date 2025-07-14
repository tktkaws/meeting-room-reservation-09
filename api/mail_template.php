<?php
/**
 * メールテンプレート処理機能
 * mailtest.phpの実装を元に、実際のCRUD処理用に最適化
 */

/**
 * 専用ログファイルに詳細なデバッグ情報を出力
 * @param string $message ログメッセージ
 * @param string $level ログレベル（INFO, ERROR, DEBUG）
 * @param array $context 追加のコンテキスト情報
 */
function writeEmailDebugLog($message, $level = 'INFO', $context = []) {
    $logDir = __DIR__ . '/../logs';
    $logFile = $logDir . '/email_debug.log';
    
    // ディレクトリが存在しない場合は作成
    if (!is_dir($logDir)) {
        mkdir($logDir, 0755, true);
    }
    
    $timestamp = date('Y-m-d H:i:s');
    $contextStr = !empty($context) ? ' | Context: ' . json_encode($context, JSON_UNESCAPED_UNICODE) : '';
    $logEntry = "[{$timestamp}] [{$level}] {$message}{$contextStr}" . PHP_EOL;
    
    // ファイルに追記（ロック付き）
    file_put_contents($logFile, $logEntry, FILE_APPEND | LOCK_EX);
}

/**
 * 予約データからテンプレート変数を生成
 * @param array $reservation 予約データ
 * @param string $action アクション種別
 * @return array テンプレート変数配列
 */
function generateTemplateVariables($reservation, $action) {
    $actionText = [
        'created' => '新規予約',
        'updated' => '予約変更',
        'deleted' => '予約削除'
    ];
    
    $actionEmoji = [
        'created' => '✅',
        'updated' => '🔄',
        'deleted' => '🗑️'
    ];
    
    $actionLabel = $actionText[$action] ?? '予約通知';
    $emoji = $actionEmoji[$action] ?? '📅';
    
    // 日付フォーマット
    $dateFormatted = date('Y年n月j日（' . ['日', '月', '火', '水', '木', '金', '土'][date('w', strtotime($reservation['date']))] . '）', strtotime($reservation['date']));
    $startTime = date('H:i', strtotime($reservation['start_datetime']));
    $endTime = date('H:i', strtotime($reservation['end_datetime']));
    $sendDatetime = date('Y年n月j日 H:i');
    
    return [
        'action_label' => $actionLabel,
        'action_emoji' => $emoji,
        'title' => trim($reservation['title'] ?? ''),
        'description' => trim($reservation['description'] ?? ''),
        'date_formatted' => $dateFormatted,
        'start_time' => $startTime,
        'end_time' => $endTime,
        'user_name' => trim($reservation['user_name'] ?? ''),
        'department' => trim($reservation['department_name'] ?? '未設定'),
        'send_datetime' => $sendDatetime
    ];
}

/**
 * テキストメール本文を生成
 * @param array $reservation 予約データ
 * @param string $action アクション種別
 * @return string メール本文
 */
function generateTextMailFromTemplate($reservation, $action) {
    $variables = generateTemplateVariables($reservation, $action);
    
    $content = <<<EOT
{$variables['action_emoji']} {$variables['action_label']}

日時　　： {$variables['date_formatted']} {$variables['start_time']}～{$variables['end_time']}
タイトル： {$variables['title']}
予約者　： {$variables['user_name']} ({$variables['department']})
詳細　　： {$variables['description']}

会議室予約システム
http://intra2.jama.co.jp/meeting-room-reservation-09/
EOT;
    
    return $content;
}

/**
 * メール件名を生成
 * @param array $reservation 予約データ
 * @param string $action アクション種別
 * @return string メール件名
 */
function generateMailSubject($reservation, $action) {
    $actionText = [
        'created' => '新規予約',
        'updated' => '予約変更',
        'deleted' => '予約削除'
    ];
    
    $actionLabel = $actionText[$action] ?? '予約通知';
    
    // 日付フォーマット: 2025年7月11日（金）
    $date = new DateTime($reservation['date']);
    $dateFormatted = $date->format('Y年n月j日') . '（' . ['日', '月', '火', '水', '木', '金', '土'][$date->format('w')] . '）';
    
    // 時間フォーマット: 12:45～13:45
    $startTime = date('G:i', strtotime($reservation['start_datetime']));
    $endTime = date('G:i', strtotime($reservation['end_datetime']));
    
    // 件名: [新規予約] 2025年7月11日（金）12:45～13:45
    return "[{$actionLabel}] {$dateFormatted}{$startTime}～{$endTime}";
}

/**
 * メール件名をエンコードする関数
 */
function encodeSubject($subject) {
    // ASCII文字のみの場合はエンコードしない
    if (preg_match('/^[\x20-\x7E]*$/', $subject)) {
        return $subject;
    }
    
    // 文字列が長すぎる場合は短縮
    $maxLength = 40;
    if (mb_strlen($subject, 'UTF-8') > $maxLength) {
        $subject = mb_substr($subject, 0, $maxLength - 3, 'UTF-8') . '...';
    }
    
    // Base64エンコード
    return '=?UTF-8?B?' . base64_encode($subject) . '?=';
}

/**
 * メール送信（新規作成・更新用）
 * @param array $reservationData 予約データ
 * @param string $action アクション種別（'created' or 'updated'）
 */
function sendReservationEmailNotification($reservationData, $action) {
    writeEmailDebugLog("メール送信開始", "INFO", [
        'action' => $action,
        'reservation_id' => $reservationData['id'] ?? 'unknown',
        'title' => $reservationData['title'] ?? ''
    ]);
    
    // メール送信ON/OFFフラグ
    /*
    // メール送信を無効にする場合は以下の行のコメントアウトを外してください
    return true;
    */
    
    try {
        $db = getDB();
        writeEmailDebugLog("データベース接続成功", "DEBUG");
        
        // 通知対象ユーザーを取得
        $sql = "SELECT u.id, u.name, u.email, u.department_id, d.name as department_name FROM users u LEFT JOIN departments d ON u.department_id = d.id WHERE u.email_notification = 1 ORDER BY u.name ASC";
        $stmt = $db->prepare($sql);
        $stmt->execute();
        $targetUsers = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        writeEmailDebugLog("通知対象ユーザー取得完了", "DEBUG", [
            'user_count' => count($targetUsers),
            'users' => array_column($targetUsers, 'email')
        ]);
        
        if (empty($targetUsers)) {
            writeEmailDebugLog("通知対象ユーザーなし - 処理終了", "INFO");
            return true; // エラーではないので成功として扱う
        }
        
        // メール内容を生成
        $subject = generateMailSubject($reservationData, $action);
        $textContent = generateTextMailFromTemplate($reservationData, $action);
        
        writeEmailDebugLog("メール内容生成完了", "DEBUG", [
            'subject' => $subject,
            'content_length' => strlen($textContent)
        ]);
        
        // メール送信
        $successCount = 0;
        $failCount = 0;
        
        foreach ($targetUsers as $user) {
            $fromEmail = 'meeting-room-reservation@jama.co.jp';
            $fromName = '会議室予約システム';
            
            $headers = [
                'MIME-Version: 1.0',
                'Content-Type: text/plain; charset=UTF-8',
                'Content-Transfer-Encoding: base64',
                'From: ' . mb_encode_mimeheader($fromName, 'UTF-8') . ' <' . $fromEmail . '>',
                'Reply-To: ' . $fromEmail,
                'X-Mailer: PHP/' . phpversion(),
                'X-Priority: 3'
            ];
            
            $headerString = implode("\r\n", $headers);
            $encodedSubject = encodeSubject($subject);
            
            // UTF-8として正しくエンコード
            $textContent = mb_convert_encoding($textContent, 'UTF-8', 'UTF-8');
            $encodedTextContent = base64_encode($textContent);
            
            writeEmailDebugLog("メール送信試行", "DEBUG", [
                'target_email' => $user['email'],
                'user_id' => $user['id']
            ]);
            
            if (mail($user['email'], $encodedSubject, $encodedTextContent, $headerString)) {
                $successCount++;
                writeEmailDebugLog("メール送信成功", "DEBUG", [
                    'target_email' => $user['email']
                ]);
            } else {
                $failCount++;
                writeEmailDebugLog("メール送信失敗", "ERROR", [
                    'target_email' => $user['email']
                ]);
            }
        }
        
        writeEmailDebugLog("メール送信完了", "INFO", [
            'success_count' => $successCount,
            'fail_count' => $failCount,
            'total_count' => count($targetUsers),
            'action' => $action
        ]);
        
        return $successCount > 0; // 1件でも成功すれば成功とする
        
    } catch (Exception $e) {
        writeEmailDebugLog("メール送信エラー（同期処理）", "ERROR", [
            'error_message' => $e->getMessage(),
            'action' => $action,
            'file' => $e->getFile(),
            'line' => $e->getLine()
        ]);
        error_log("メール送信エラー: " . $e->getMessage());
        return false;
    }
}

/**
 * 削除時のメール送信（削除前に同期実行）
 * @param array $reservationData 削除前に取得した予約データ
 */
function sendReservationEmailNotificationForDeleted($reservationData) {
    writeEmailDebugLog("削除メール送信開始", "INFO", [
        'reservation_id' => $reservationData['id'] ?? 'unknown',
        'title' => $reservationData['title'] ?? ''
    ]);
    
    // メール送信ON/OFFフラグ
    /*
    // メール送信を無効にする場合は以下の行のコメントアウトを外してください
    return true;
    */
    
    try {
        $db = getDB();
        writeEmailDebugLog("データベース接続成功（削除）", "DEBUG");
        
        // 通知対象ユーザーを取得
        $sql = "SELECT u.id, u.name, u.email, u.department_id, d.name as department_name FROM users u LEFT JOIN departments d ON u.department_id = d.id WHERE u.email_notification = 1 ORDER BY u.name ASC";
        $stmt = $db->prepare($sql);
        $stmt->execute();
        $targetUsers = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        writeEmailDebugLog("通知対象ユーザー取得完了（削除）", "DEBUG", [
            'user_count' => count($targetUsers),
            'users' => array_column($targetUsers, 'email')
        ]);
        
        if (empty($targetUsers)) {
            writeEmailDebugLog("通知対象ユーザーなし（削除）- 処理終了", "INFO");
            return true; // エラーではないので成功として扱う
        }
        
        // テンプレートを使用してメール内容を生成
        $subject = generateMailSubject($reservationData, 'deleted');
        $textContent = generateTextMailFromTemplate($reservationData, 'deleted');
        
        writeEmailDebugLog("削除メール内容生成完了", "DEBUG", [
            'subject' => $subject,
            'content_length' => strlen($textContent)
        ]);
        
        // メール送信（削除時は同期処理）
        $successCount = 0;
        $failCount = 0;
        
        foreach ($targetUsers as $user) {
            $fromEmail = 'meeting-room-reservation@jama.co.jp';
            $fromName = '会議室予約システム';
            
            $headers = [
                'MIME-Version: 1.0',
                'Content-Type: text/plain; charset=UTF-8',
                'Content-Transfer-Encoding: base64',
                'From: ' . mb_encode_mimeheader($fromName, 'UTF-8') . ' <' . $fromEmail . '>',
                'Reply-To: ' . $fromEmail,
                'X-Mailer: PHP/' . phpversion(),
                'X-Priority: 3'
            ];
            
            $headerString = implode("\r\n", $headers);
            $encodedSubject = encodeSubject($subject);
            
            // UTF-8として正しくエンコード
            $textContent = mb_convert_encoding($textContent, 'UTF-8', 'UTF-8');
            $encodedTextContent = base64_encode($textContent);
            
            writeEmailDebugLog("削除メール送信試行", "DEBUG", [
                'target_email' => $user['email'],
                'user_id' => $user['id']
            ]);
            
            if (mail($user['email'], $encodedSubject, $encodedTextContent, $headerString)) {
                $successCount++;
                writeEmailDebugLog("削除メール送信成功", "DEBUG", [
                    'target_email' => $user['email']
                ]);
            } else {
                $failCount++;
                writeEmailDebugLog("削除メール送信失敗", "ERROR", [
                    'target_email' => $user['email']
                ]);
            }
        }
        
        writeEmailDebugLog("削除メール送信完了", "INFO", [
            'success_count' => $successCount,
            'fail_count' => $failCount,
            'total_count' => count($targetUsers)
        ]);
        
        return $successCount > 0; // 1件でも成功すれば成功とする
        
    } catch (Exception $e) {
        writeEmailDebugLog("削除メール通知エラー", "ERROR", [
            'error_message' => $e->getMessage(),
            'file' => $e->getFile(),
            'line' => $e->getLine()
        ]);
        error_log("削除メール通知エラー: " . $e->getMessage());
        return false;
    }
}
?>