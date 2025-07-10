<?php
require_once '../api/config.php';

$message = '';
$error = '';

// POST処理
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (isset($_POST['action'])) {
        switch ($_POST['action']) {
            case 'delete_db':
                $result = deleteDatabase();
                if ($result['success']) {
                    $message = $result['message'];
                } else {
                    $error = $result['message'];
                }
                break;
                
            case 'import_csv':
                $result = importFromCSV();
                if ($result['success']) {
                    $message = $result['message'];
                } else {
                    $error = $result['message'];
                }
                break;
                
            case 'init_db':
                $result = initializeDatabase();
                if ($result['success']) {
                    $message = $result['message'];
                } else {
                    $error = $result['message'];
                }
                break;
                
            case 'import_new_reserve_csv':
                $result = importNewReserveCsv();
                if ($result['success']) {
                    $message = $result['message'];
                } else {
                    $error = $result['message'];
                }
                break;
                
        }
    }
}

// データベース削除
function deleteDatabase() {
    try {
        $dbPath = DB_PATH;
        if (file_exists($dbPath)) {
            unlink($dbPath);
            return ['success' => true, 'message' => 'データベースを削除しました。'];
        } else {
            return ['success' => false, 'message' => 'データベースファイルが見つかりません。'];
        }
    } catch (Exception $e) {
        return ['success' => false, 'message' => 'データベース削除エラー: ' . $e->getMessage()];
    }
}

// データベース初期化
function initializeDatabase() {
    try {
        $pdo = getDB();
        
        // SQLファイルを読み込んで実行
        $sql = file_get_contents(dirname(__FILE__) . '/meeting-room-reservation.sql');
        $pdo->exec($sql);
        
        // 初期部署データの投入
        // $departments = [
        //     [1, '総務部', '#FF6B6B', 1],
        //     [2, '営業部', '#4ECDC4', 2],
        //     [3, '開発部', '#45B7D1', 3],
        //     [4, '人事部', '#96CEB4', 4],
        //     [5, '経理部', '#FFEAA7', 5]
        // ];
        
        // $stmt = $pdo->prepare("INSERT OR REPLACE INTO departments (id, name, default_color, display_order) VALUES (?, ?, ?, ?)");
        // foreach ($departments as $dept) {
        //     $stmt->execute($dept);
        // }
        
        // 管理者ユーザーの作成
        // $adminEmail = 'admin@company.com';
        // $adminPassword = hashPassword('admin123');
        
        // $stmt = $pdo->prepare("INSERT OR REPLACE INTO users (id, name, email, password, admin, department_id, email_notification) VALUES (?, ?, ?, ?, ?, ?, ?)");
        // $stmt->execute([1, '管理者', $adminEmail, $adminPassword, true, 1, false]);
        
        return ['success' => true, 'message' => 'データベースを初期化しました。管理者ユーザー: admin@company.com / admin123'];
    } catch (Exception $e) {
        return ['success' => false, 'message' => 'データベース初期化エラー: ' . $e->getMessage()];
    }
}

// CSVインポート
function importFromCSV() {
    try {
        $pdo = getDB();
        $results = [];
        
        // departments.csvの処理
        if (isset($_FILES['departments_csv']) && $_FILES['departments_csv']['error'] === UPLOAD_ERR_OK) {
            $result = importDepartments($pdo, $_FILES['departments_csv']['tmp_name']);
            $results[] = $result;
        }
        
        // users.csvの処理
        if (isset($_FILES['users_csv']) && $_FILES['users_csv']['error'] === UPLOAD_ERR_OK) {
            $result = importUsers($pdo, $_FILES['users_csv']['tmp_name']);
            $results[] = $result;
        }
        
        // reservations.csvの処理
        if (isset($_FILES['reservations_csv']) && $_FILES['reservations_csv']['error'] === UPLOAD_ERR_OK) {
            $result = importReservations($pdo, $_FILES['reservations_csv']['tmp_name']);
            $results[] = $result;
        }
        
        if (empty($results)) {
            return ['success' => false, 'message' => 'CSVファイルが選択されていません。'];
        }
        
        $message = implode('<br>', $results);
        return ['success' => true, 'message' => $message];
        
    } catch (Exception $e) {
        return ['success' => false, 'message' => 'CSVインポートエラー: ' . $e->getMessage()];
    }
}

// 部署CSVインポート
function importDepartments($pdo, $csvFile) {
    $handle = fopen($csvFile, 'r');
    if (!$handle) {
        return '部署CSVファイルを開けませんでした。';
    }
    
    $header = fgetcsv($handle); // ヘッダー行をスキップ
    $count = 0;
    
    $stmt = $pdo->prepare("INSERT OR REPLACE INTO departments (id, name, default_color, display_order) VALUES (?, ?, ?, ?)");
    
    while (($data = fgetcsv($handle)) !== false) {
        $id = $data[0];
        $name = $data[1];
        $default_color = $data[2] ?? '#718096';
        $display_order = $data[3] ?? 0;
        
        $stmt->execute([$id, $name, $default_color, $display_order]);
        $count++;
    }
    
    fclose($handle);
    return "部署データ {$count}件をインポートしました。";
}

// ユーザーCSVインポート
function importUsers($pdo, $csvFile) {
    $handle = fopen($csvFile, 'r');
    if (!$handle) {
        return 'ユーザーCSVファイルを開けませんでした。';
    }
    
    $header = fgetcsv($handle); // ヘッダー行をスキップ
    $count = 0;
    
    $stmt = $pdo->prepare("INSERT OR REPLACE INTO users (id, name, email, password, admin, department_id, email_notification) VALUES (?, ?, ?, ?, ?, ?, ?)");
    
    while (($data = fgetcsv($handle)) !== false) {
        $id = $data[0];
        $name = $data[1];
        $email = $data[2];
        $password = hashPassword($data[3]);
        $admin = ($data[4] === 'TRUE' || $data[4] === '1') ? true : false;
        $department_id = $data[5];
        $email_notification = ($data[6] === 'TRUE' || $data[6] === '1') ? true : false;
        
        $stmt->execute([$id, $name, $email, $password, $admin, $department_id, $email_notification]);
        $count++;
    }
    
    fclose($handle);
    return "ユーザーデータ {$count}件をインポートしました。";
}

// 予約CSVインポート
function importReservations($pdo, $csvFile) {
    $handle = fopen($csvFile, 'r');
    if (!$handle) {
        return '予約CSVファイルを開けませんでした。';
    }
    
    $header = fgetcsv($handle); // ヘッダー行をスキップ
    $count = 0;
    
    $stmt = $pdo->prepare("INSERT OR REPLACE INTO reservations (id, user_id, title, description, date, start_datetime, end_datetime, is_company_wide) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    
    while (($data = fgetcsv($handle)) !== false) {
        $id = $data[0];
        $user_id = $data[1];
        $title = $data[2];
        $description = $data[3] ?? '';
        $date = $data[4];
        $start_datetime = $data[5];
        $end_datetime = $data[6];
        $is_company_wide = ($data[7] === 'TRUE' || $data[7] === '1') ? true : false;
        
        $stmt->execute([$id, $user_id, $title, $description, $date, $start_datetime, $end_datetime, $is_company_wide]);
        $count++;
    }
    
    fclose($handle);
    return "予約データ {$count}件をインポートしました。";
}

// 新形式予約データCSVインポート
function importNewReserveCsv() {
    try {
        $pdo = getDB();
        $results = [];
        
        // new_reserve_csv.csvの処理
        if (isset($_FILES['new_reserve_csv']) && $_FILES['new_reserve_csv']['error'] === UPLOAD_ERR_OK) {
            $result = importNewReserveFromCsv($pdo, $_FILES['new_reserve_csv']['tmp_name']);
            $results[] = $result;
        }
        
        if (empty($results)) {
            return ['success' => false, 'message' => 'CSVファイルが選択されていません。'];
        }
        
        $message = implode('<br>', $results);
        return ['success' => true, 'message' => $message];
        
    } catch (Exception $e) {
        return ['success' => false, 'message' => '新形式予約CSVインポートエラー: ' . $e->getMessage()];
    }
}

// 新形式予約CSVインポート処理
function importNewReserveFromCsv($pdo, $csvFile) {
    $handle = fopen($csvFile, 'r');
    if (!$handle) {
        return '新形式予約CSVファイルを開けませんでした。';
    }
    
    $header = fgetcsv($handle); // ヘッダー行をスキップ
    $count = 0;
    $errorCount = 0;
    
    $stmt = $pdo->prepare("INSERT INTO reservations (id, user_id, title, description, date, start_datetime, end_datetime, is_company_wide) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    
    while (($data = fgetcsv($handle)) !== false) {
        try {
            // CSVの構造: id,user_id,title,is_company_wide,年,月,日,開始時,開始分,終了時,終了分
            $id = $data[0];
            $userId = $data[1];
            $title = $data[2];
            $isCompanyWide = ($data[3] === 'TRUE' || $data[3] === '1') ? true : false;
            $year = $data[4];
            $month = $data[5];
            $day = $data[6];
            $startHour = $data[7];
            $startMinute = $data[8];
            $endHour = $data[9];
            $endMinute = $data[10];
            
            // 日付の作成
            $date = sprintf('%04d-%02d-%02d', $year, $month, $day);
            $startDatetime = sprintf('%04d-%02d-%02d %02d:%02d:00', $year, $month, $day, $startHour, $startMinute);
            $endDatetime = sprintf('%04d-%02d-%02d %02d:%02d:00', $year, $month, $day, $endHour, $endMinute);
            
            // 説明は空にする（必要に応じて後で追加可能）
            $description = '';
            
            $stmt->execute([$id, $userId, $title, $description, $date, $startDatetime, $endDatetime, $isCompanyWide]);
            $count++;
            
        } catch (Exception $e) {
            $errorCount++;
            error_log("新形式予約データインポートエラー（行 " . ($count + $errorCount + 2) . "）: " . $e->getMessage());
        }
    }
    
    fclose($handle);
    
    $message = "新形式予約データ {$count}件をインポートしました。";
    if ($errorCount > 0) {
        $message .= " （エラー: {$errorCount}件）";
    }
    
    return $message;
}


// データベース状態取得
function getDatabaseStatus() {
    try {
        if (!file_exists(DB_PATH)) {
            return ['exists' => false, 'message' => 'データベースファイルが存在しません。'];
        }
        
        $pdo = getDB();
        $status = ['exists' => true, 'tables' => []];
        
        // テーブル一覧取得
        $stmt = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
        $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);
        
        foreach ($tables as $table) {
            $stmt = $pdo->query("SELECT COUNT(*) FROM {$table}");
            $count = $stmt->fetchColumn();
            $status['tables'][$table] = $count;
        }
        
        return $status;
    } catch (Exception $e) {
        return ['exists' => false, 'message' => 'データベース状態取得エラー: ' . $e->getMessage()];
    }
}

// テーブルデータ取得
function getTableData() {
    try {
        if (!file_exists(DB_PATH)) {
            return ['success' => false, 'message' => 'データベースファイルが存在しません。'];
        }
        
        $pdo = getDB();
        $data = [];
        
        // 部署データ
        $stmt = $pdo->query("SELECT * FROM departments ORDER BY display_order ASC, id ASC LIMIT 50");
        $data['departments'] = $stmt->fetchAll();
        
        // ユーザーデータ（パスワードは除外）
        $stmt = $pdo->query("
            SELECT u.id, u.name, u.email, u.admin, d.name as department_name, 
                   u.email_notification, u.color_setting, u.created_at 
            FROM users u 
            LEFT JOIN departments d ON u.department_id = d.id 
            ORDER BY u.id DESC LIMIT 50
        ");
        $data['users'] = $stmt->fetchAll();
        
        // 予約データ
        $stmt = $pdo->query("
            SELECT r.id, r.title, r.description, r.date, r.start_datetime, r.end_datetime, 
                   r.is_company_wide, u.name as user_name, d.name as department_name, r.created_at
            FROM reservations r 
            LEFT JOIN users u ON r.user_id = u.id 
            LEFT JOIN departments d ON u.department_id = d.id 
            ORDER BY r.id DESC LIMIT 50
        ");
        $data['reservations'] = $stmt->fetchAll();
        
        return ['success' => true, 'data' => $data];
    } catch (Exception $e) {
        return ['success' => false, 'message' => 'データ取得エラー: ' . $e->getMessage()];
    }
}

$dbStatus = getDatabaseStatus();
$tableData = getTableData();
?>

<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>データベース管理 - 会議室予約システム</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background-color: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #2c3e50;
            border-bottom: 3px solid #3498db;
            padding-bottom: 10px;
        }
        h2 {
            color: #34495e;
            margin-top: 30px;
        }
        h3 {
            color: #2c3e50;
            margin-top: 25px;
        }
        .section {
            margin-bottom: 30px;
            padding: 20px;
            border: 1px solid #ecf0f1;
            border-radius: 5px;
        }
        .message {
            padding: 10px;
            margin: 10px 0;
            border-radius: 4px;
        }
        .success {
            background-color: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        .error {
            background-color: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
        .warning {
            background-color: #fff3cd;
            color: #856404;
            border: 1px solid #ffeaa7;
        }
        .btn {
            background-color: #3498db;
            color: white;
            padding: 10px 20px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            margin-right: 10px;
        }
        .btn:hover {
            background-color: #2980b9;
        }
        .btn-danger {
            background-color: #e74c3c;
        }
        .btn-danger:hover {
            background-color: #c0392b;
        }
        .btn-warning {
            background-color: #f39c12;
        }
        .btn-warning:hover {
            background-color: #e67e22;
        }
        .form-group {
            margin-bottom: 15px;
        }
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
        }
        input[type="file"] {
            margin-bottom: 10px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
            font-size: 12px;
        }
        table th,
        table td {
            padding: 8px;
            text-align: left;
            border-bottom: 1px solid #ddd;
            max-width: 200px;
            word-wrap: break-word;
        }
        table th {
            background-color: #f8f9fa;
            font-weight: bold;
            position: sticky;
            top: 0;
        }
        .status-ok {
            color: #27ae60;
        }
        .status-error {
            color: #e74c3c;
        }
        .csv-format {
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
            margin-top: 10px;
        }
        .csv-format code {
            font-family: monospace;
            background-color: #e9ecef;
            padding: 2px 4px;
            border-radius: 3px;
        }
        .data-table {
            max-height: 400px;
            overflow-y: auto;
            border: 1px solid #ddd;
            border-radius: 4px;
        }
        .bool-true {
            color: #27ae60;
            font-weight: bold;
        }
        .bool-false {
            color: #e74c3c;
        }
        .text-truncate {
            max-width: 150px;
            overflow: hidden;
            text-overflow: ellipsis;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>データベース管理</h1>
        
        <?php if ($message): ?>
            <div class="message success"><?php echo $message; ?></div>
        <?php endif; ?>
        
        <?php if ($error): ?>
            <div class="message error"><?php echo $error; ?></div>
        <?php endif; ?>
        
        <!-- データベース状態 -->
        <div class="section">
            <h2>データベース状態</h2>
            <?php if ($dbStatus['exists']): ?>
                <div class="message success">
                    <strong>データベースは正常に動作しています</strong>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>テーブル名</th>
                            <th>レコード数</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($dbStatus['tables'] as $table => $count): ?>
                            <tr>
                                <td><?php echo htmlspecialchars($table); ?></td>
                                <td class="status-ok"><?php echo $count; ?>件</td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            <?php else: ?>
                <div class="message error">
                    <?php echo htmlspecialchars($dbStatus['message']); ?>
                </div>
            <?php endif; ?>
        </div>

        <!-- テーブルデータ一覧 -->
        <?php if ($tableData['success']): ?>
            <div class="section">
                <h2>テーブルデータ一覧（最新50件）</h2>
                
                <!-- 部署データ -->
                <h3>部署データ</h3>
                <div class="data-table">
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>部署名</th>
                                <th>デフォルトカラー</th>
                                <th>表示順序</th>
                                <th>作成日時</th>
                                <th>更新日時</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($tableData['data']['departments'] as $dept): ?>
                                <tr>
                                    <td><?php echo htmlspecialchars($dept['id']); ?></td>
                                    <td><?php echo htmlspecialchars($dept['name']); ?></td>
                                    <td>
                                        <span style="background-color: <?php echo htmlspecialchars($dept['default_color']); ?>; padding: 2px 8px; color: white; border-radius: 3px;">
                                            <?php echo htmlspecialchars($dept['default_color']); ?>
                                        </span>
                                    </td>
                                    <td><?php echo htmlspecialchars($dept['display_order']); ?></td>
                                    <td><?php echo htmlspecialchars($dept['created_at']); ?></td>
                                    <td><?php echo htmlspecialchars($dept['updated_at']); ?></td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>

                <!-- ユーザーデータ -->
                <h3>ユーザーデータ</h3>
                <div class="data-table">
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>名前</th>
                                <th>メールアドレス</th>
                                <th>管理者</th>
                                <th>部署</th>
                                <th>メール通知</th>
                                <th>カラー設定</th>
                                <th>作成日時</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($tableData['data']['users'] as $user): ?>
                                <tr>
                                    <td><?php echo htmlspecialchars($user['id']); ?></td>
                                    <td><?php echo htmlspecialchars($user['name']); ?></td>
                                    <td class="text-truncate"><?php echo htmlspecialchars($user['email']); ?></td>
                                    <td>
                                        <span class="<?php echo $user['admin'] ? 'bool-true' : 'bool-false'; ?>">
                                            <?php echo $user['admin'] ? 'はい' : 'いいえ'; ?>
                                        </span>
                                    </td>
                                    <td><?php echo htmlspecialchars($user['department_name'] ?? '未設定'); ?></td>
                                    <td>
                                        <span class="<?php echo $user['email_notification'] ? 'bool-true' : 'bool-false'; ?>">
                                            <?php echo $user['email_notification'] ? 'はい' : 'いいえ'; ?>
                                        </span>
                                    </td>
                                    <td class="text-truncate">
                                        <?php if ($user['color_setting']): ?>
                                            <code><?php echo htmlspecialchars($user['color_setting']); ?></code>
                                        <?php else: ?>
                                            <span style="color: #999;">未設定</span>
                                        <?php endif; ?>
                                    </td>
                                    <td><?php echo htmlspecialchars($user['created_at']); ?></td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>

                <!-- 予約データ -->
                <h3>予約データ</h3>
                <div class="data-table">
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>タイトル</th>
                                <th>詳細</th>
                                <th>日付</th>
                                <th>開始時刻</th>
                                <th>終了時刻</th>
                                <th>全社共通</th>
                                <th>予約者</th>
                                <th>部署</th>
                                <th>作成日時</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($tableData['data']['reservations'] as $reservation): ?>
                                <tr>
                                    <td><?php echo htmlspecialchars($reservation['id']); ?></td>
                                    <td class="text-truncate"><?php echo htmlspecialchars($reservation['title']); ?></td>
                                    <td class="text-truncate"><?php echo htmlspecialchars($reservation['description'] ?? ''); ?></td>
                                    <td><?php echo htmlspecialchars($reservation['date']); ?></td>
                                    <td><?php echo htmlspecialchars(date('H:i', strtotime($reservation['start_datetime']))); ?></td>
                                    <td><?php echo htmlspecialchars(date('H:i', strtotime($reservation['end_datetime']))); ?></td>
                                    <td>
                                        <span class="<?php echo $reservation['is_company_wide'] ? 'bool-true' : 'bool-false'; ?>">
                                            <?php echo $reservation['is_company_wide'] ? 'はい' : 'いいえ'; ?>
                                        </span>
                                    </td>
                                    <td><?php echo htmlspecialchars($reservation['user_name'] ?? '未設定'); ?></td>
                                    <td><?php echo htmlspecialchars($reservation['department_name'] ?? '未設定'); ?></td>
                                    <td><?php echo htmlspecialchars($reservation['created_at']); ?></td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
            </div>
        <?php endif; ?>
        
        <!-- データベース初期化 -->
        <div class="section">
            <h2>データベース初期化</h2>
            <p>テーブルを作成し、初期データを投入します。</p>
            <form method="post" style="display: inline;">
                <input type="hidden" name="action" value="init_db">
                <button type="submit" class="btn btn-warning" onclick="return confirm('データベースを初期化しますか？既存のデータは失われます。')">
                    データベース初期化
                </button>
            </form>
        </div>
        
        <!-- CSVインポート -->
        <div class="section">
            <h2>CSVインポート</h2>
            <form method="post" enctype="multipart/form-data">
                <input type="hidden" name="action" value="import_csv">
                
                <div class="form-group">
                    <label for="departments_csv">部署データ (departments.csv)</label>
                    <input type="file" id="departments_csv" name="departments_csv" accept=".csv">
                </div>
                
                <div class="form-group">
                    <label for="users_csv">ユーザーデータ (users.csv)</label>
                    <input type="file" id="users_csv" name="users_csv" accept=".csv">
                </div>
                
                <div class="form-group">
                    <label for="reservations_csv">予約データ (reservations.csv)</label>
                    <input type="file" id="reservations_csv" name="reservations_csv" accept=".csv">
                </div>
                
                <button type="submit" class="btn">CSVインポート実行</button>
            </form>
            
            <div class="csv-format">
                <h3>CSVファイル形式</h3>
                <p><strong>departments.csv:</strong></p>
                <code>id,name,default_color,display_order</code><br>
                <code>1,総務部,#FF6B6B,1</code>
                
                <p><strong>users.csv:</strong></p>
                <code>id,name,email,password,admin,department_id,email_notification</code><br>
                <code>1,管理者,admin@company.com,admin123,TRUE,1,FALSE</code>
                
                <p><strong>reservations.csv:</strong></p>
                <code>id,user_id,title,description,date,start_datetime,end_datetime,is_company_wide</code><br>
                <code>1,1,会議,定例会議,2025-07-15,2025-07-15T10:00:00,2025-07-15T11:00:00,FALSE</code>
            </div>
        </div>
        
        <!-- 新形式予約データCSVインポート -->
        <div class="section">
            <h2>新形式予約データCSVインポート</h2>
            <p>reserve_0710_new.csv形式の予約データをインポートします。</p>
            <form method="post" enctype="multipart/form-data">
                <input type="hidden" name="action" value="import_new_reserve_csv">
                
                <div class="form-group">
                    <label for="new_reserve_csv">新形式予約データCSV (reserve_0710_new.csv形式)</label>
                    <input type="file" id="new_reserve_csv" name="new_reserve_csv" accept=".csv" required>
                </div>
                
                <button type="submit" class="btn">新形式予約CSVインポート実行</button>
            </form>
            
            <div class="csv-format">
                <h3>CSVファイル形式（新形式）</h3>
                <p><strong>reserve_0710_new.csv:</strong></p>
                <code>id,user_id,title,is_company_wide,年,月,日,開始時,開始分,終了時,終了分</code><br>
                <code>1,26,営業推進会議,FALSE,2025,7,10,9,0,11,30</code>
                
                <h4>フィールド説明</h4>
                <ul style="margin-top: 10px; padding-left: 20px;">
                    <li><strong>id</strong>: 予約ID（ユニーク）</li>
                    <li><strong>user_id</strong>: 予約者のユーザーID</li>
                    <li><strong>title</strong>: 予約タイトル</li>
                    <li><strong>is_company_wide</strong>: 全社共通かどうか（TRUE/FALSE）</li>
                    <li><strong>年月日・時分</strong>: 予約の日時として結合</li>
                </ul>
            </div>
        </div>
        
        <!-- データベース削除 -->
        <div class="section">
            <h2>データベース削除</h2>
            <div class="message warning">
                <strong>警告:</strong> この操作は元に戻すことができません。全てのデータが失われます。
            </div>
            <form method="post" style="display: inline;">
                <input type="hidden" name="action" value="delete_db">
                <button type="submit" class="btn btn-danger" onclick="return confirm('本当にデータベースを削除しますか？この操作は元に戻すことができません。')">
                    データベース削除
                </button>
            </form>
        </div>
        
        <div style="margin-top: 30px; text-align: center;">
            <a href="../index.html" class="btn">メイン画面に戻る</a>
        </div>
    </div>
</body>
</html>