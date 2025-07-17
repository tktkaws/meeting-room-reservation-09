// カレンダー表示管理

import { 
    getFirstDayOfMonth, 
    getLastDayOfMonth, 
    getFirstDayOfWeek, 
    getLastDayOfWeek,
    getDateString,
    formatDate,
    formatDateJapanese,
    formatTime,
    createElement,
    clearElement,
    showModal,
    hideModal,
    getContrastColor
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
        this.loadSavedView();
        this.setupEventListeners();
        this.updateNavigationDisplay();
        
        // リサイズイベントリスナーを追加
        window.addEventListener('resize', () => this.handleResize());
    }

    setupEventListeners() {
        // ビュー切り替え
        document.getElementById('monthView').addEventListener('click', () => this.changeView('month'));
        document.getElementById('weekView').addEventListener('click', () => this.changeView('week'));
        document.getElementById('listView').addEventListener('click', () => this.changeView('list'));

        // 今日ボタン
        document.getElementById('todayBtn').addEventListener('click', () => this.goToToday());

        // ナビゲーションボタン
        document.getElementById('prevBtnMonth').addEventListener('click', () => this.navigatePrev());
        document.getElementById('nextBtnMonth').addEventListener('click', () => this.navigateNext());
    }

    // ビュー変更
    changeView(view) {
        this.currentView = view;
        
        // ビュー状態を保存
        this.saveCurrentView();
        
        // ボタンのアクティブ状態更新
        document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(`${view}View`).classList.add('active');
        
        // currentDateを今日に更新
        this.currentDate = new Date();
        
        // ナビゲーション/リストコントロール表示切り替え
        this.updateControlsVisibility();
        
        // ナビゲーション表示更新
        this.updateNavigationDisplay();
        
        // リストビューの場合、コントロールを設定
        if (view === 'list') {
            this.setupListViewControls();
        }
        
        // カレンダー表示更新
        this.render();
        
        // 表示期間の予約情報を自動取得
        if (window.reservationManager) {
            window.reservationManager.loadReservations();
        }
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
        
        // 表示期間の予約情報を自動取得
        if (window.reservationManager) {
            window.reservationManager.loadReservations();
        }
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
        
        // 表示期間の予約情報を自動取得
        if (window.reservationManager) {
            window.reservationManager.loadReservations();
        }
    }

    // 今日へ移動
    goToToday() {
        this.currentDate = new Date();
        this.updateNavigationDisplay();
        this.render();
        
        // 表示期間の予約情報を自動取得
        if (window.reservationManager) {
            window.reservationManager.loadReservations();
        }
    }

    // コントロール表示切り替え
    updateControlsVisibility() {
        const navigation = document.querySelector('.navigation');
        const listControls = document.querySelector('.list-controls');
        
        if (this.currentView === 'list') {
            navigation.style.display = 'none';
            listControls.style.display = 'grid';
        } else {
            navigation.style.display = 'grid';
            listControls.style.display = 'none';
        }
    }

    // ナビゲーション表示更新
    updateNavigationDisplay() {
        const currentDateElement = document.getElementById('currentDate');
        if (!currentDateElement) return;
        
        switch (this.currentView) {
            case 'month':
                currentDateElement.textContent = `${this.currentDate.getFullYear()}年${this.currentDate.getMonth() + 1}月`;
                break;
            case 'week':
                const weekStart = getFirstDayOfWeek(this.currentDate);
                const weekEnd = getLastDayOfWeek(this.currentDate);
                currentDateElement.textContent = `${formatDateJapanese(weekStart)} - ${formatDateJapanese(weekEnd)}`;
                break;
            case 'list':
                // リストビューではナビゲーション表示なし
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
        const header = createElement('ul', 'month-header');
        const dayNames = ['月', '火', '水', '木', '金'];
        dayNames.forEach(day => {
            const headerCell = createElement('li', 'month-header-cell', day);
            header.appendChild(headerCell);
        });
        container.appendChild(header);

        // カレンダーグリッド作成
        const calendar = createElement('ul', 'month-calendar');
        
        const firstDay = getFirstDayOfMonth(this.currentDate);
        const lastDay = getLastDayOfMonth(this.currentDate);
        
        // 月の最初の営業日（月曜日）を取得
        const startDate = getFirstDayOfWeek(firstDay);
        
        // 月の最後の営業日（金曜日）を取得
        const endDate = new Date(lastDay);
        while (endDate.getDay() !== 5) { // 金曜日になるまで進める
            endDate.setDate(endDate.getDate() + 1);
        }
        
        // 必要な週数を計算
        const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
        const weeks = Math.ceil(totalDays / 7);
        
        // 各週の平日セルを生成（other-monthのみの週は除外）
        for (let week = 0; week < weeks; week++) {
            let hasCurrentMonthCell = false;
            const weekCells = [];
            
            // 各週の平日をチェック
            for (let day = 0; day < 5; day++) { // 0-4 (月-金)
                const cellDate = new Date(startDate);
                cellDate.setDate(startDate.getDate() + (week * 7) + day);
                
                // 土日チェック（念のため）
                const dayOfWeek = cellDate.getDay();
                if (dayOfWeek === 0 || dayOfWeek === 6) {
                    continue;
                }
                
                // 現在の月のセルがあるかチェック
                if (cellDate.getMonth() === this.currentDate.getMonth()) {
                    hasCurrentMonthCell = true;
                }
                
                const cell = this.createMonthCell(cellDate);
                weekCells.push(cell);
            }
            
            // 現在の月のセルが1つでもあれば、その週のセルを追加
            if (hasCurrentMonthCell) {
                weekCells.forEach(cell => calendar.appendChild(cell));
            }
        }
        
        container.appendChild(calendar);
    }

    // 月間セル作成
    createMonthCell(date) {
        // 日付が現在の月でない場合のクラス
        const otherMonthClass = date.getMonth() !== this.currentDate.getMonth() ? ' other-month' : '';
        
        // 今日の場合のクラス
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const cellDate = new Date(date);
        cellDate.setHours(0, 0, 0, 0);
        const todayClass = cellDate.getTime() === today.getTime() ? ' today' : '';
        
        // 過去の日付の場合のクラス
        const pastClass = cellDate.getTime() < today.getTime() ? ' past' : '';
        
        // 予約表示
        const dayReservations = this.getReservationsForDate(date);
        const reservationsHtml = dayReservations.map(reservation => {
            const startTime = formatTime(reservation.start_datetime);
            const endTime = formatTime(reservation.end_datetime);
            const timeRange = `${startTime}-${endTime}`;
            
            return `
                <li class="reservation-item">
                    <button class="reservation-item-btn" style="border-color: ${authManager.getReservationColor(reservation)};" data-reservation-id="${reservation.id}">
                        <div class="reservation-item-time">${timeRange}</div>
                        <div class="reservation-item-title">${reservation.title}</div>
                    </button>
                </li>
            `;
        }).join('');
        
        const cellHtml = `
            <li class="month-cell${otherMonthClass}${todayClass}${pastClass}">
                <button class="month-cell-btn" data-date="${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}">
                    <div class="cell-date"><span>${date.getDate()}</span></div>
                </button>
                <ul class="cell-reservations">
                    ${reservationsHtml}
                </ul>
            </li>
        `;
        
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = cellHtml;
        const cell = tempDiv.firstElementChild;
        
        // 予約クリックイベント
        cell.querySelectorAll('.reservation-item-btn').forEach(reservationButton => {
            reservationButton.addEventListener('click', (e) => {
                e.stopPropagation();
                const reservationId = reservationButton.dataset.reservationId;
                const reservation = dayReservations.find(r => r.id == reservationId);
                if (reservation) {
                    this.showReservationDetails(reservation);
                }
            });
        });
        
        // セルクリックイベント（今日以降のみ）
        if (cellDate.getTime() >= today.getTime()) {
            const cellButton = cell.querySelector('.month-cell-btn');
            if (cellButton) {
                cellButton.addEventListener('click', () => {
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
            }
        }
        
        return cell;
    }

    // 週間ビュー描画
    renderWeekView() {
        const container = document.getElementById('weekCalendar');
        clearElement(container);
        
        // 動的な time-slot の高さを計算
        this.calculateAndSetTimeSlotHeight();

        // 時間軸の作成
        const timeLabelsHtml = Array.from({length: 9}, (_, i) => `
            <div class="time-label"><span>${i + 9}:00</span></div>
        `).join('');
        
        const timeAxisHtml = `
            <div class="week-time-axis">
                <div class="time-axis-header"></div>
                ${timeLabelsHtml}
            </div>
        `;

        // 各日のカラムを作成
        const weekStart = getFirstDayOfWeek(this.currentDate);
        const dayNames = ['月', '火', '水', '木', '金'];
        const today = new Date();
        
        const dayColumnsHtml = Array.from({length: 5}, (_, i) => {
            const date = new Date(weekStart);
            date.setDate(weekStart.getDate() + i);
            
            const todayClass = date.toDateString() === today.toDateString() ? ' today' : '';
            
            // 時間スロット（15分刻み）
            const timeSlotsHtml = Array.from({length: 36}, (_, slotIndex) => {
                const hour = Math.floor(slotIndex / 4) + 9;
                const minute = (slotIndex % 4) * 15;
                return `<li class="time-slot">
                    <button class="time-slot-btn" data-hour="${hour}" data-minute="${minute}"></button>
                </li>`;
            }).join('');
            
            return `
                <div class="day-column" data-date="${getDateString(date)}">
                    <div class="day-header${todayClass}">
                        <div class="day-header-week"><span>${dayNames[i]}</span></div>
                        <div class="day-header-date"><span>${date.getDate()}</span></div>
                    </div>
                    <div class="day-body" style="position: relative;">
                        <ul class="week-reservation-list">
                        </ul>
                        <ul class="time-grid">
                            ${timeSlotsHtml}
                        </ul>
                    </div>
                </div>
            `;
        }).join('');

        const weekContainerHtml = `
            <div class="week-view-container">
                ${timeAxisHtml}
                ${dayColumnsHtml}
            </div>
        `;

        container.innerHTML = weekContainerHtml;
        
        // イベントリスナーの設定
        this.setupWeekViewEventListeners();
        
        // 予約を配置
        this.renderAllWeekReservations();
        
        // 初回描画後に予約位置を更新
        setTimeout(() => this.updateWeekReservationsPositions(), 0);
        
        // 現在時刻ラインを追加
        this.addCurrentTimeLineToWeekView();
    }

    // 週間ビューのイベントリスナー設定
    setupWeekViewEventListeners() {
        const timeSlotButtons = document.querySelectorAll('.time-slot-btn');
        timeSlotButtons.forEach(button => {
            button.addEventListener('click', () => {
                if (authManager.getLoginStatus().isLoggedIn) {
                    const hour = parseInt(button.dataset.hour);
                    const minute = parseInt(button.dataset.minute);
                    const dayColumn = button.closest('.day-column');
                    const dateString = dayColumn.dataset.date;
                    
                    const [year, month, day] = dateString.split('-').map(Number);
                    const slotDate = new Date(year, month - 1, day, hour, minute, 0, 0);
                    
                    this.showNewReservationModal(slotDate);
                }
            });
        });
    }

    // 全ての週間予約を配置
    renderAllWeekReservations() {
        const dayColumns = document.querySelectorAll('.day-column');
        dayColumns.forEach(dayColumn => {
            const dateString = dayColumn.dataset.date;
            const [year, month, day] = dateString.split('-').map(Number);
            const date = new Date(year, month - 1, day);
            const timeGrid = dayColumn.querySelector('.day-body');
            
            this.renderDayReservations(timeGrid, date);
        });
    }

    // 日本時間取得
    getJapanTime() {
        const now = new Date();
        // JST (UTC+9)
        const jstOffset = 9 * 60 * 60 * 1000;
        const utc = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
        return new Date(utc + jstOffset);
    }

    // 週間ビューのセル高さを取得（最適化版）
    getWeekTimeHeaderHeight() {
        // CSS変数から直接取得（パフォーマンス向上）
        const timeSlotHeight = parseInt(document.documentElement.style.getPropertyValue('--time-slot-height') || '20');
        return timeSlotHeight;
    }

    // 現在時刻ラインを作成
    createCurrentTimeLine() {
        const now = this.getJapanTime();
        const currentHours = now.getHours();
        const currentMinutes = now.getMinutes();

        // 営業時間外の場合は表示しない
        if (currentHours < 9 || currentHours >= 18) {
            return null;
        }

        // 現在時刻を15分単位に調整
        const totalMinutes = (currentHours - 9) * 60 + currentMinutes;
        const slotIndex = Math.floor(totalMinutes / 15);
        const slotOffset = (totalMinutes % 15) / 15;

        // 動的なセル高さを取得
        const cellHeight = this.getWeekTimeHeaderHeight();

        // 位置を計算（cellHeight per slot + offset）
        const position = slotIndex * cellHeight + (slotOffset * cellHeight);

        return `<div class="current-time-line" style="top: ${position}px;">
                    <div class="current-time-marker"></div>
                </div>`;
    }

    // 週間ビューに現在時刻ラインを追加
    addCurrentTimeLineToWeekView() {
        const currentTimeLineHtml = this.createCurrentTimeLine();
        if (!currentTimeLineHtml) return;

        // 今日の日付を取得
        const today = new Date();
        const todayString = getDateString(today);
        
        // 今日の日付に対応するday-columnを探す
        const dayColumns = document.querySelectorAll('.day-column');
        dayColumns.forEach(dayColumn => {
            if (dayColumn.dataset.date === todayString) {
                const timeGrid = dayColumn.querySelector('.day-body');
                if (timeGrid) {
                    timeGrid.insertAdjacentHTML('beforeend', currentTimeLineHtml);
                }
            }
        });
    }

    // 各日の予約を絶対配置で重ねる
    renderDayReservations(timeGrid, date) {
        const dateString = getDateString(date);
        const dayReservations = this.getReservationsForDate(date);
        
        // 開始時間の早い順にソート
        dayReservations.sort((a, b) => {
            const timeA = new Date(a.start_datetime);
            const timeB = new Date(b.start_datetime);
            return timeA - timeB;
        });
        
        // week-reservation-listを取得
        const weekReservationList = timeGrid.querySelector('.week-reservation-list');
        if (!weekReservationList) return;
        
        dayReservations.forEach(reservation => {
            const startTime = new Date(reservation.start_datetime);
            const endTime = new Date(reservation.end_datetime);
            
            // 予約の開始・終了時間を15分単位のスロット番号に変換
            const startSlot = this.getTimeSlotIndex(startTime);
            const endSlot = this.getTimeSlotIndex(endTime);
            
            // 予約要素を作成（li要素として）
            const reservationElement = createElement('li', 'week-reservation');
            
            // ボタン要素を作成
            const reservationButton = createElement('button', 'week-reservation-btn');
            
            // span要素でテキストを囲む
            const titleSpan = createElement('span');
            titleSpan.textContent = reservation.title;
            reservationButton.appendChild(titleSpan);
            const backgroundColor = authManager.getReservationColor(reservation);
            const departmentName = reservation.department_name || reservation.user_department_name || '部署不明';
            reservationButton.style.backgroundColor = backgroundColor;
            reservationButton.style.color = getContrastColor(backgroundColor, departmentName);
            
            // li要素に絶対配置で位置を設定（9時基準でtop: 0pxから開始）
            // --time-slot-heightから動的に高さを取得
            const slotHeight = parseInt(document.documentElement.style.getPropertyValue('--time-slot-height') || '20');
            
            reservationElement.style.position = 'absolute';
            reservationElement.style.top = `${startSlot * slotHeight}px`;
            reservationElement.style.height = `${(endSlot - startSlot) * slotHeight - 2}px`;
            reservationElement.style.left = '2px';
            reservationElement.style.right = '2px';
            reservationElement.style.zIndex = '10';
            
            // クリックイベントをボタンに設定
            reservationButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showReservationDetails(reservation);
            });
            
            // データ属性を設定（後の更新処理で使用）
            reservationButton.dataset.startTime = `${startTime.getHours().toString().padStart(2, '0')}:${startTime.getMinutes().toString().padStart(2, '0')}`;
            reservationButton.dataset.endTime = `${endTime.getHours().toString().padStart(2, '0')}:${endTime.getMinutes().toString().padStart(2, '0')}`;
            
            // ボタンをli要素に追加
            reservationElement.appendChild(reservationButton);
            
            weekReservationList.appendChild(reservationElement);
        });
    }
    
    // 時間を15分単位のスロット番号に変換
    getTimeSlotIndex(datetime) {
        const hour = datetime.getHours();
        const minute = datetime.getMinutes();
        
        // 9:00を基準（0番）とする
        const hourFromNine = hour - 9;
        const slotIndex = (hourFromNine * 4) + (minute / 15);
        
        return slotIndex;
    }

    // リストビュー描画
    renderListView() {
        const container = document.getElementById('listCalendar');
        clearElement(container);

        // 予約の表示（フィルタリングなし - 既にloadReservationsで適切にフィルタリング済み）
        const displayReservations = this.reservations.slice();
        displayReservations.sort((a, b) => new Date(a.start_datetime) - new Date(b.start_datetime));

        // リストアイテムのHTML生成（Grid形式）
        const listItemsHtml = displayReservations.map(reservation => {
            const borderColor = authManager.getReservationColor(reservation);
            const startTime = formatTime(reservation.start_datetime);
            const endTime = formatTime(reservation.end_datetime);
            const dateFormatted = formatDate(reservation.date);
            
            return `
                <li class="reservation-list-item">
                    <button class="reservation-list-item-btn" data-reservation-id="${reservation.id}">
                        <span class="theme-color-icon" style="background-color: ${borderColor};">■</span>
                        <div class="reservation-date">
                            ${dateFormatted}
                        </div>
                        <div class="reservation-time">${startTime} - ${endTime}</div>
                        <div class="reservation-title">${reservation.title}</div>
                        <div class="reservation-user">${reservation.user_name} (${reservation.department_name})</div>
                    </button>
                </li>
            `;
        }).join('');

        const listHtml = `
            <div class="reservation-list">
                <div class="reservation-list-header">
                    <div class="header-icon"></div>
                    <div class="header-date">日付</div>
                    <div class="header-time">時間</div>
                    <div class="header-title">タイトル</div>
                    <div class="header-user">予約者</div>
                </div>
                <ul class="reservation-list-items">
                    ${listItemsHtml}
                </ul>
            </div>
        `;

        container.innerHTML = listHtml;
        
        // イベントリスナーを設定
        this.setupListViewEventListeners();
    }

    // リストビューのイベントリスナー設定
    setupListViewEventListeners() {
        const listButtons = document.querySelectorAll('.reservation-list-item button');
        listButtons.forEach(button => {
            button.addEventListener('click', () => {
                const reservationId = button.dataset.reservationId;
                const reservation = this.reservations.find(r => r.id == reservationId);
                if (reservation) {
                    this.showReservationDetails(reservation);
                }
            });
        });
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
        item.style.borderLeft = `4px solid ${authManager.getReservationColor(reservation)}`;
        
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
            <dl class="reservation-details">
                <div class="detail-row">
                    <dt>タイトル</dt>
                    <dd>${reservation.title}</dd>
                </div>
                
                <div class="detail-row">
                    <dt>日付</dt>
                    <dd>${formatDate(reservation.date)}</dd>
                </div>
                
                <div class="detail-row">
                    <dt>時間</dt>
                    <dd>${formatTime(reservation.start_datetime)} - ${formatTime(reservation.end_datetime)}</dd>
                </div>
                
                <div class="detail-row">
                    <dt>予約者</dt>
                    <dd>${reservation.user_name} (${reservation.department_name})</dd>
                </div>
                
                <div class="detail-row">
                    <dt>詳細</dt>
                    <dd>${reservation.description || 'なし'}</dd>
                </div>
            </dl>
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

    // リストビューのコントロール設定
    setupListViewControls() {
        const currentBtn = document.querySelector('#current-btn');
        const pastBtn = document.querySelector('#past-btn');
        const pastRangeForm = document.querySelector('.past-range-form');
        const applyRangeBtn = document.querySelector('#apply-range-btn');
        
        // 初期状態では今後の予定をアクティブに
        if (currentBtn) {
            currentBtn.classList.add('active');
        }
        if (pastBtn) {
            pastBtn.classList.remove('active');
        }
        
        // 日付フォームの初期化
        this.initializeDateForm();
        
        if (currentBtn) {
            currentBtn.addEventListener('click', () => {
                currentBtn.classList.add('active');
                pastBtn.classList.remove('active');
                pastRangeForm.style.display = 'none';
                this.loadCurrentReservations();
            });
        }
        
        if (pastBtn) {
            pastBtn.addEventListener('click', () => {
                pastBtn.classList.add('active');
                currentBtn.classList.remove('active');
                pastRangeForm.style.display = 'block';
                this.loadPastReservations();
            });
        }
        
        // セレクトボックスの変更イベントを監視
        const selects = ['start-year', 'start-month', 'end-year', 'end-month'];
        selects.forEach(selectId => {
            const selectElement = document.getElementById(selectId);
            if (selectElement) {
                selectElement.addEventListener('change', () => {
                    this.loadPastReservationsWithRange();
                });
            }
        });
    }

    // 日付フォームの初期化
    initializeDateForm() {
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth() + 1;
        
        // 直近3ヶ月前の開始日を計算
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 3);
        const startYear = startDate.getFullYear();
        const startMonth = startDate.getMonth() + 1;
        
        // 年のオプションを生成（過去3年分）
        const startYearSelect = document.getElementById('start-year');
        const endYearSelect = document.getElementById('end-year');
        
        for (let year = currentYear - 2; year <= currentYear; year++) {
            const option1 = new Option(year + '年', year);
            const option2 = new Option(year + '年', year);
            startYearSelect.add(option1);
            endYearSelect.add(option2);
        }
        
        // 月のオプションを生成
        const startMonthSelect = document.getElementById('start-month');
        const endMonthSelect = document.getElementById('end-month');
        
        for (let month = 1; month <= 12; month++) {
            const option1 = new Option(month + '月', month);
            const option2 = new Option(month + '月', month);
            startMonthSelect.add(option1);
            endMonthSelect.add(option2);
        }
        
        // 初期値を設定（直近3ヶ月）
        startYearSelect.value = startYear;
        startMonthSelect.value = startMonth;
        endYearSelect.value = currentYear;
        endMonthSelect.value = currentMonth;
    }

    // 範囲指定での過去の予約読み込み
    loadPastReservationsWithRange() {
        const startYear = document.getElementById('start-year').value;
        const startMonth = document.getElementById('start-month').value;
        const endYear = document.getElementById('end-year').value;
        const endMonth = document.getElementById('end-month').value;
        
        if (window.reservationManager) {
            window.reservationManager.loadPastReservationsWithRange(
                parseInt(startYear),
                parseInt(startMonth),
                parseInt(endYear),
                parseInt(endMonth)
            );
        }
    }

    // ビュー状態を保存
    saveCurrentView() {
        try {
            localStorage.setItem('calendarView', this.currentView);
        } catch (error) {
            console.error('ビュー状態の保存に失敗しました:', error);
        }
    }

    // 保存されたビュー状態を読み込み
    loadSavedView() {
        try {
            const savedView = localStorage.getItem('calendarView');
            if (savedView && ['month', 'week', 'list'].includes(savedView)) {
                this.currentView = savedView;
                
                // ボタンのアクティブ状態更新
                document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
                const targetBtn = document.getElementById(`${savedView}View`);
                if (targetBtn) {
                    targetBtn.classList.add('active');
                }
                
                // コントロール表示を更新
                this.updateControlsVisibility();
                
                // リストビューの場合はコントロール設定
                if (savedView === 'list') {
                    this.setupListViewControls();
                }
            }
        } catch (error) {
            console.error('ビュー状態の読み込みに失敗しました:', error);
        }
    }

    // time-slot の高さを動的に計算・設定
    calculateAndSetTimeSlotHeight() {
        const viewportHeight = window.innerHeight;
        const contentHeaderHeight = 80; // 5rem = 80px
        const dayHeaderHeight = 60; // 60px
        const availableHeight = viewportHeight - contentHeaderHeight - dayHeaderHeight;
        const slotCount = 36; // 9時-18時の15分刻み
        
        // 最低20pxを保証
        const calculatedHeight = Math.max(20, Math.floor(availableHeight / slotCount));
        
        // CSS変数として設定
        document.documentElement.style.setProperty('--time-slot-height', `${calculatedHeight}px`);
        
        return calculatedHeight;
    }
    
    // リサイズ時の処理
    handleResize() {
        if (this.currentView === 'week') {
            this.calculateAndSetTimeSlotHeight();
            this.updateWeekReservationsPositions();
        }
    }
    
    // 週間ビューの予約位置を更新
    updateWeekReservationsPositions() {
        const timeSlotHeight = parseInt(document.documentElement.style.getPropertyValue('--time-slot-height') || '20');
        
        // week-reservation要素の更新
        const reservationElements = document.querySelectorAll('.week-reservation');
        reservationElements.forEach(element => {
            const button = element.querySelector('.week-reservation-btn');
            if (button) {
                const startTime = button.dataset.startTime;
                const endTime = button.dataset.endTime;
                
                if (startTime && endTime) {
                    const position = this.calculateReservationPosition(startTime, endTime, timeSlotHeight);
                    element.style.top = `${position.top}px`;
                    element.style.height = `${position.height - 2}px`; // -2pxで元の処理と一致
                    element.style.position = 'absolute';
                    element.style.left = '2px';
                    element.style.right = '2px';
                    element.style.zIndex = '10';
                }
            }
        });
    }
    
    // 予約の位置計算
    calculateReservationPosition(startTime, endTime, slotHeight) {
        const startHour = parseInt(startTime.split(':')[0]);
        const startMinute = parseInt(startTime.split(':')[1]);
        const endHour = parseInt(endTime.split(':')[0]);
        const endMinute = parseInt(endTime.split(':')[1]);
        
        const startSlot = (startHour - 9) * 4 + Math.floor(startMinute / 15);
        const endSlot = (endHour - 9) * 4 + Math.floor(endMinute / 15);
        
        return {
            top: startSlot * slotHeight,
            height: (endSlot - startSlot) * slotHeight
        };
    }
}

export default CalendarManager;