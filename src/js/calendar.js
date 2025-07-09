// カレンダー表示管理

import { 
    getFirstDayOfMonth, 
    getLastDayOfMonth, 
    getFirstDayOfWeek, 
    getLastDayOfWeek,
    getDateString,
    formatDate,
    formatTime,
    createElement,
    clearElement,
    showModal,
    hideModal
} from './utils.js';
import authManager from './auth.js';

class CalendarManager {
    constructor() {
        this.currentDate = new Date();
        this.currentView = 'month';
        this.reservations = [];
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.updateNavigationDisplay();
    }

    setupEventListeners() {
        // ビュー切り替え
        document.getElementById('monthView').addEventListener('click', () => this.changeView('month'));
        document.getElementById('weekView').addEventListener('click', () => this.changeView('week'));
        document.getElementById('listView').addEventListener('click', () => this.changeView('list'));

        // ナビゲーション
        document.getElementById('prevBtn').addEventListener('click', () => this.navigatePrev());
        document.getElementById('nextBtn').addEventListener('click', () => this.navigateNext());
        document.getElementById('todayBtn').addEventListener('click', () => this.goToToday());
    }

    // ビュー変更
    changeView(view) {
        this.currentView = view;
        
        // ボタンのアクティブ状態更新
        document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(`${view}View`).classList.add('active');
        
        // カレンダー表示更新
        this.render();
    }

    // 前へナビゲート
    navigatePrev() {
        switch (this.currentView) {
            case 'month':
                this.currentDate.setMonth(this.currentDate.getMonth() - 1);
                break;
            case 'week':
                this.currentDate.setDate(this.currentDate.getDate() - 7);
                break;
            case 'list':
                // リストビューでは期間を変更
                this.currentDate.setMonth(this.currentDate.getMonth() - 1);
                break;
        }
        this.updateNavigationDisplay();
        this.render();
    }

    // 次へナビゲート
    navigateNext() {
        switch (this.currentView) {
            case 'month':
                this.currentDate.setMonth(this.currentDate.getMonth() + 1);
                break;
            case 'week':
                this.currentDate.setDate(this.currentDate.getDate() + 7);
                break;
            case 'list':
                // リストビューでは期間を変更
                this.currentDate.setMonth(this.currentDate.getMonth() + 1);
                break;
        }
        this.updateNavigationDisplay();
        this.render();
    }

    // 今日へ移動
    goToToday() {
        this.currentDate = new Date();
        this.updateNavigationDisplay();
        this.render();
    }

    // ナビゲーション表示更新
    updateNavigationDisplay() {
        const currentDateElement = document.getElementById('currentDate');
        
        switch (this.currentView) {
            case 'month':
                currentDateElement.textContent = `${this.currentDate.getFullYear()}年${this.currentDate.getMonth() + 1}月`;
                break;
            case 'week':
                const weekStart = getFirstDayOfWeek(this.currentDate);
                const weekEnd = getLastDayOfWeek(this.currentDate);
                currentDateElement.textContent = `${formatDate(weekStart)} - ${formatDate(weekEnd)}`;
                break;
            case 'list':
                currentDateElement.textContent = `${this.currentDate.getFullYear()}年${this.currentDate.getMonth() + 1}月`;
                break;
        }
    }

    // 予約データ設定
    setReservations(reservations) {
        this.reservations = reservations;
        this.render();
    }

    // カレンダー描画
    render() {
        // 全てのカレンダービューを非表示
        document.querySelectorAll('.calendar-view').forEach(view => {
            view.style.display = 'none';
        });

        // 現在のビューを表示
        const currentViewElement = document.getElementById(`${this.currentView}Calendar`);
        if (currentViewElement) {
            currentViewElement.style.display = 'block';
        }

        // ビューに応じた描画
        switch (this.currentView) {
            case 'month':
                this.renderMonthView();
                break;
            case 'week':
                this.renderWeekView();
                break;
            case 'list':
                this.renderListView();
                break;
        }
    }

    // 月間ビュー描画
    renderMonthView() {
        const container = document.getElementById('monthCalendar');
        clearElement(container);

        // ヘッダー作成（土日を除く）
        const header = createElement('div', 'month-header');
        const dayNames = ['月', '火', '水', '木', '金'];
        dayNames.forEach(day => {
            const headerCell = createElement('div', 'month-header-cell', day);
            header.appendChild(headerCell);
        });
        container.appendChild(header);

        // カレンダーグリッド作成
        const calendar = createElement('div', 'month-calendar');
        
        const firstDay = getFirstDayOfMonth(this.currentDate);
        const lastDay = getLastDayOfMonth(this.currentDate);
        
        // 月の最初の週の月曜日を取得
        const startDate = getFirstDayOfWeek(firstDay);
        
        // 6週間分の平日のみを生成
        for (let week = 0; week < 6; week++) {
            for (let day = 0; day < 5; day++) { // 0-4 (月-金)
                const cellDate = new Date(startDate);
                cellDate.setDate(startDate.getDate() + (week * 7) + day);
                
                // 土日チェック（念のため）
                const dayOfWeek = cellDate.getDay(); // 0=日曜日, 6=土曜日
                if (dayOfWeek === 0 || dayOfWeek === 6) {
                    continue; // 土日の場合はセルを生成しない
                }
                
                const cell = this.createMonthCell(cellDate);
                calendar.appendChild(cell);
            }
        }
        
        container.appendChild(calendar);
    }

    // 月間セル作成
    createMonthCell(date) {
        const cell = createElement('div', 'month-cell');
        
        // 日付が現在の月でない場合
        if (date.getMonth() !== this.currentDate.getMonth()) {
            cell.classList.add('other-month');
        }
        
        // 今日の場合
        const today = new Date();
        if (date.toDateString() === today.toDateString()) {
            cell.classList.add('today');
        }
        
        // 日付表示
        const dateElement = createElement('div', 'cell-date', date.getDate());
        cell.appendChild(dateElement);
        
        // 予約表示
        const reservationsContainer = createElement('div', 'cell-reservations');
        const dayReservations = this.getReservationsForDate(date);
        
        dayReservations.forEach(reservation => {
            const reservationElement = createElement('div', 'reservation-item');
            reservationElement.textContent = reservation.title;
            reservationElement.style.backgroundColor = authManager.getDepartmentColor(reservation.user_department_id);
            reservationElement.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showReservationDetails(reservation);
            });
            reservationsContainer.appendChild(reservationElement);
        });
        
        cell.appendChild(reservationsContainer);
        
        // セルクリックイベント
        cell.addEventListener('click', () => {
            if (authManager.getLoginStatus().isLoggedIn) {
                // 土日チェック
                const dayOfWeek = date.getDay(); // 0=日曜日, 6=土曜日
                if (dayOfWeek === 0 || dayOfWeek === 6) {
                    alert('土日の予約はできません。');
                    return;
                }
                // 正確な日付オブジェクトを渡す
                const clickedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
                this.showNewReservationModal(clickedDate);
            }
        });
        
        return cell;
    }

    // 週間ビュー描画
    renderWeekView() {
        const container = document.getElementById('weekCalendar');
        clearElement(container);

        // ヘッダー作成
        const header = createElement('div', 'week-header');
        
        // 空のセル（時間列用）
        const emptyCell = createElement('div', 'week-time-slot');
        header.appendChild(emptyCell);
        
        // 曜日ヘッダー（土日を除く）
        const weekStart = getFirstDayOfWeek(this.currentDate);
        const dayNames = ['月', '火', '水', '木', '金'];
        
        for (let i = 0; i < 5; i++) { // 0-4 (月-金)
            const date = new Date(weekStart);
            date.setDate(weekStart.getDate() + i);
            
            const headerCell = createElement('div', 'week-time-slot');
            headerCell.innerHTML = `${dayNames[i]}<br>${date.getDate()}`;
            
            // 今日の場合
            const today = new Date();
            if (date.toDateString() === today.toDateString()) {
                headerCell.classList.add('today');
            }
            
            header.appendChild(headerCell);
        }
        
        container.appendChild(header);

        // タイムグリッド作成
        const grid = createElement('div', 'week-calendar');
        
        // 9:00-18:00の時間スロット（15分刻み）
        for (let hour = 9; hour < 18; hour++) {
            for (let minute = 0; minute < 60; minute += 15) {
                // 時間セル
                const timeCell = createElement('div', 'week-time-slot');
                if (minute === 0) {
                    timeCell.textContent = `${hour}:00`;
                    timeCell.classList.add('hour-start');
                }
                grid.appendChild(timeCell);
                
                // 各日のセル（土日を除く）
                for (let day = 0; day < 5; day++) { // 0-4 (月-金)
                    const cellDate = new Date(weekStart);
                    cellDate.setDate(weekStart.getDate() + day);
                    cellDate.setHours(hour, minute, 0, 0);
                    
                    const cell = this.createWeekCell(cellDate);
                    grid.appendChild(cell);
                }
            }
        }
        
        container.appendChild(grid);
    }

    // 週間セル作成
    createWeekCell(datetime) {
        const cell = createElement('div', 'week-cell');
        
        // 予約があるかチェック
        const reservation = this.getReservationForDateTime(datetime);
        if (reservation) {
            cell.textContent = reservation.title;
            cell.style.backgroundColor = authManager.getDepartmentColor(reservation.user_department_id);
            cell.style.color = 'white';
            cell.addEventListener('click', () => {
                this.showReservationDetails(reservation);
            });
        } else {
            // 空のセルの場合、新規予約作成
            cell.addEventListener('click', () => {
                if (authManager.getLoginStatus().isLoggedIn) {
                    // 土日チェック
                    const dayOfWeek = datetime.getDay(); // 0=日曜日, 6=土曜日
                    if (dayOfWeek === 0 || dayOfWeek === 6) {
                        alert('土日の予約はできません。');
                        return;
                    }
                    this.showNewReservationModal(datetime);
                }
            });
        }
        
        return cell;
    }

    // リストビュー描画
    renderListView() {
        const container = document.getElementById('listCalendar');
        clearElement(container);

        // コントロール作成
        const controls = createElement('div', 'list-controls');
        
        const currentBtn = createElement('button', '', '今後の予定');
        currentBtn.addEventListener('click', () => this.loadCurrentReservations());
        
        const pastBtn = createElement('button', '', '過去の予定');
        pastBtn.addEventListener('click', () => this.loadPastReservations());
        
        controls.appendChild(currentBtn);
        controls.appendChild(pastBtn);
        container.appendChild(controls);

        // 予約リスト作成
        const listContainer = createElement('div', 'reservation-list');
        
        // 今日以降の予約を表示
        const futureReservations = this.reservations.filter(r => {
            const reservationDate = new Date(r.date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return reservationDate >= today;
        });

        futureReservations.sort((a, b) => new Date(a.start_datetime) - new Date(b.start_datetime));

        futureReservations.forEach(reservation => {
            const item = this.createListItem(reservation);
            listContainer.appendChild(item);
        });
        
        container.appendChild(listContainer);
    }

    // リストアイテム作成
    createListItem(reservation) {
        const item = createElement('div', 'reservation-list-item');
        
        const info = createElement('div', 'reservation-info');
        
        const title = createElement('div', 'reservation-title', reservation.title);
        const details = createElement('div', 'reservation-details');
        details.innerHTML = `${formatDate(reservation.date)} | ${reservation.user_name} (${reservation.department_name})`;
        
        info.appendChild(title);
        info.appendChild(details);
        
        const time = createElement('div', 'reservation-time');
        time.textContent = `${formatTime(reservation.start_datetime)} - ${formatTime(reservation.end_datetime)}`;
        
        item.appendChild(info);
        item.appendChild(time);
        
        // カラー表示
        item.style.borderLeft = `4px solid ${authManager.getDepartmentColor(reservation.user_department_id)}`;
        
        // クリックイベント
        item.addEventListener('click', () => {
            this.showReservationDetails(reservation);
        });
        
        return item;
    }

    // 指定日の予約取得
    getReservationsForDate(date) {
        const dateString = getDateString(date);
        const filtered = this.reservations.filter(r => r.date === dateString);
        
        // デバッグ用ログ（一時的）
        if (filtered.length > 0) {
            console.log('予約マッチング:', {
                cellDate: dateString,
                reservations: filtered.map(r => ({ title: r.title, date: r.date }))
            });
        }
        
        return filtered;
    }

    // 指定時刻の予約取得
    getReservationForDateTime(datetime) {
        const dateString = getDateString(datetime);
        const timeString = datetime.toTimeString().substring(0, 5);
        
        return this.reservations.find(r => {
            const startTime = new Date(r.start_datetime);
            const endTime = new Date(r.end_datetime);
            return r.date === dateString && 
                   datetime >= startTime && 
                   datetime < endTime;
        });
    }

    // 予約詳細表示
    showReservationDetails(reservation) {
        const modal = document.getElementById('reservationModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalContent = document.getElementById('modalContent');
        
        modalTitle.textContent = '予約詳細';
        
        const content = `
            <div class="form-group">
                <label>タイトル</label>
                <div>${reservation.title}</div>
            </div>
            <div class="form-group">
                <label>日付</label>
                <div>${formatDate(reservation.date)}</div>
            </div>
            <div class="form-group">
                <label>時間</label>
                <div>${formatTime(reservation.start_datetime)} - ${formatTime(reservation.end_datetime)}</div>
            </div>
            <div class="form-group">
                <label>予約者</label>
                <div>${reservation.user_name} (${reservation.department_name})</div>
            </div>
            <div class="form-group">
                <label>詳細</label>
                <div>${reservation.description || 'なし'}</div>
            </div>
        `;
        
        modalContent.innerHTML = content;
        
        // 編集・削除ボタン
        if (authManager.canEditReservation(reservation)) {
            const actions = createElement('div', 'form-actions');
            
            const editBtn = createElement('button', '', '編集');
            editBtn.addEventListener('click', () => {
                hideModal('reservationModal');
                this.showEditReservationModal(reservation);
            });
            
            const deleteBtn = createElement('button', 'danger', '削除');
            deleteBtn.addEventListener('click', () => {
                this.deleteReservation(reservation);
            });
            
            actions.appendChild(editBtn);
            actions.appendChild(deleteBtn);
            modalContent.appendChild(actions);
        }
        
        showModal('reservationModal');
    }

    // 新規予約モーダル表示
    showNewReservationModal(date) {
        if (window.reservationManager) {
            window.reservationManager.showNewReservationModal(date);
        }
    }

    // 編集予約モーダル表示
    showEditReservationModal(reservation) {
        if (window.reservationManager) {
            window.reservationManager.showEditReservationModal(reservation);
        }
    }

    // 予約削除
    async deleteReservation(reservation) {
        if (window.reservationManager) {
            await window.reservationManager.deleteReservation(reservation.id);
        }
    }

    // 今後の予約読み込み
    loadCurrentReservations() {
        // 実装は ReservationManager で行う
        if (window.reservationManager) {
            window.reservationManager.loadReservations();
        }
    }

    // 過去の予約読み込み
    loadPastReservations() {
        // 実装は ReservationManager で行う
        if (window.reservationManager) {
            window.reservationManager.loadPastReservations();
        }
    }
}

export default CalendarManager;