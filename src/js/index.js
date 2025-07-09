// メインページのJavaScript

import authManager from './auth.js';
import CalendarManager from './calendar.js';
import ReservationManager from './reservations.js';

// DOM読み込み完了時の処理
document.addEventListener('DOMContentLoaded', async () => {
    // カレンダーマネージャーの初期化
    const calendarManager = new CalendarManager();
    
    // 予約マネージャーの初期化
    const reservationManager = new ReservationManager(calendarManager);
    
    // グローバルに登録（他のモジュールから参照できるように）
    window.calendarManager = calendarManager;
    window.reservationManager = reservationManager;
    
    // 認証マネージャーの初期化完了を待つ
    await authManager.init();
    
    // 初期データの読み込み
    await reservationManager.loadReservations();
    
    // 認証状態が変更されたときの処理
    authManager.onAuthStateChanged = () => {
        reservationManager.loadReservations();
    };
    
    console.log('会議室予約システムが初期化されました');
});

// エラーハンドリング
window.addEventListener('error', (event) => {
    console.error('JavaScript エラー:', event.error);
});

// 未処理のPromise拒否をキャッチ
window.addEventListener('unhandledrejection', (event) => {
    console.error('未処理のPromise拒否:', event.reason);
});

// ページを離れる前の確認（編集中の場合）
window.addEventListener('beforeunload', (event) => {
    // 編集中の場合は確認メッセージを表示
    const modal = document.getElementById('reservationModal');
    if (modal && modal.style.display === 'block') {
        event.preventDefault();
        event.returnValue = '編集中の内容が失われます。本当にページを離れますか？';
    }
});

// Service Worker登録は無効化
// if ('serviceWorker' in navigator) {
//     window.addEventListener('load', async () => {
//         try {
//             const registration = await navigator.serviceWorker.register('/sw.js');
//             console.log('ServiceWorker登録成功:', registration);
//         } catch (error) {
//             console.log('ServiceWorker登録失敗:', error);
//         }
//     });
// }

// キーボードショートカット
document.addEventListener('keydown', (event) => {
    // Ctrl+N: 新規予約
    if (event.ctrlKey && event.key === 'n') {
        event.preventDefault();
        if (authManager.getLoginStatus().isLoggedIn) {
            window.reservationManager.showNewReservationModal();
        }
    }
    
    // Esc: モーダルを閉じる
    if (event.key === 'Escape') {
        const modal = document.getElementById('reservationModal');
        if (modal && modal.style.display === 'block') {
            modal.style.display = 'none';
        }
    }
    
    // 矢印キーでナビゲーション
    if (event.target.tagName !== 'INPUT' && event.target.tagName !== 'TEXTAREA') {
        switch (event.key) {
            case 'ArrowLeft':
                event.preventDefault();
                window.calendarManager.navigatePrev();
                break;
            case 'ArrowRight':
                event.preventDefault();
                window.calendarManager.navigateNext();
                break;
            case 'Home':
                event.preventDefault();
                window.calendarManager.goToToday();
                break;
        }
    }
});

// タッチイベント（スワイプ操作）
let touchStartX = 0;
let touchStartY = 0;

document.addEventListener('touchstart', (event) => {
    touchStartX = event.touches[0].clientX;
    touchStartY = event.touches[0].clientY;
});

document.addEventListener('touchend', (event) => {
    const touchEndX = event.changedTouches[0].clientX;
    const touchEndY = event.changedTouches[0].clientY;
    
    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;
    
    // 水平スワイプの場合
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
        if (deltaX > 0) {
            // 右スワイプ（前へ）
            window.calendarManager.navigatePrev();
        } else {
            // 左スワイプ（次へ）
            window.calendarManager.navigateNext();
        }
    }
});

// ウィンドウサイズ変更時の処理
let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        // カレンダーの再描画
        window.calendarManager.render();
    }, 250);
});

// 印刷用CSS適用
window.addEventListener('beforeprint', () => {
    document.body.classList.add('printing');
});

window.addEventListener('afterprint', () => {
    document.body.classList.remove('printing');
});

// ブラウザの戻る/進むボタン対応
window.addEventListener('popstate', (event) => {
    if (event.state) {
        // 状態を復元
        const { view, date } = event.state;
        window.calendarManager.currentView = view;
        window.calendarManager.currentDate = new Date(date);
        window.calendarManager.changeView(view);
    }
});

// 状態をブラウザ履歴に保存
function saveState() {
    const state = {
        view: window.calendarManager.currentView,
        date: window.calendarManager.currentDate.toISOString()
    };
    
    const url = new URL(window.location);
    url.searchParams.set('view', state.view);
    url.searchParams.set('date', state.date);
    
    history.pushState(state, '', url.toString());
}

// ビュー変更時に状態を保存
if (window.calendarManager) {
    const originalChangeView = window.calendarManager.changeView;
    window.calendarManager.changeView = function(view) {
        originalChangeView.call(this, view);
        saveState();
    };
}

// 通知権限の取得
async function requestNotificationPermission() {
    if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('通知権限が許可されました');
        }
    }
}

// 5分前通知（実装例）
function scheduleNotification(reservation) {
    if ('Notification' in window && Notification.permission === 'granted') {
        const startTime = new Date(reservation.start_datetime);
        const notificationTime = new Date(startTime.getTime() - 5 * 60 * 1000); // 5分前
        const now = new Date();
        
        if (notificationTime > now) {
            const timeout = notificationTime.getTime() - now.getTime();
            setTimeout(() => {
                new Notification(`予約開始5分前です`, {
                    body: `${reservation.title}\n${reservation.start_datetime}`,
                    icon: '/favicon.ico'
                });
            }, timeout);
        }
    }
}

// ページ可視性API（タブが非アクティブになったときの処理）
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // タブが非アクティブになった
        console.log('タブが非アクティブになりました');
    } else {
        // タブがアクティブになった
        console.log('タブがアクティブになりました');
        // データを再読み込み
        if (window.reservationManager) {
            window.reservationManager.loadReservations();
        }
    }
});

// 定期的なデータ更新（5分間隔）
setInterval(() => {
    if (!document.hidden && window.reservationManager) {
        window.reservationManager.loadReservations();
    }
}, 5 * 60 * 1000);

// デバッグ用の関数をグローバルに追加
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    window.debug = {
        authManager,
        calendarManager: () => window.calendarManager,
        reservationManager: () => window.reservationManager,
        showTestData: () => {
            console.log('認証状態:', authManager.getLoginStatus());
            console.log('予約データ:', window.reservationManager?.getReservations());
            console.log('部署データ:', authManager.departments);
        }
    };
}