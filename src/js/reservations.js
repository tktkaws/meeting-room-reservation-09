// 予約管理機能

import { 
    get, 
    post, 
    put, 
    del,
    getDateString,
    getDateTimeString,
    formatDate,
    formatTime,
    validateRequired,
    validateLength,
    validateReservationTime,
    adjustToBusinessHours,
    roundToQuarter,
    showErrorMessage,
    showSuccessMessage,
    showLoading,
    showModal,
    hideModal,
    confirm,
    createElement,
    clearElement,
    sendReservationEmail
} from './utils.js';
import authManager from './auth.js';

class ReservationManager {
    constructor(calendarManager) {
        this.calendarManager = calendarManager;
        this.reservations = [];
        this.currentEditingReservation = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadReservations();
    }

    setupEventListeners() {
        // 新規予約ボタン
        const createBtn = document.getElementById('createReservationBtn');
        if (createBtn) {
            createBtn.addEventListener('click', () => this.showNewReservationModal());
        }


    }

    // 予約一覧取得
    async loadReservations() {
        try {
            let params = '';
            
            // ビューに応じてパラメータを設定
            if (this.calendarManager.currentView === 'month') {
                const firstDay = new Date(this.calendarManager.currentDate.getFullYear(), this.calendarManager.currentDate.getMonth(), 1);
                const lastDay = new Date(this.calendarManager.currentDate.getFullYear(), this.calendarManager.currentDate.getMonth() + 1, 0);
                params = `?start_date=${getDateString(firstDay)}&end_date=${getDateString(lastDay)}`;
            } else if (this.calendarManager.currentView === 'week') {
                const weekStart = this.getFirstDayOfWeek(this.calendarManager.currentDate);
                const weekEnd = this.getLastDayOfWeek(this.calendarManager.currentDate);
                params = `?start_date=${getDateString(weekStart)}&end_date=${getDateString(weekEnd)}`;
            } else {
                params = '?view_type=list&current=true';
            }
            
            const response = await get(`api/reservations.php${params}`);
            this.reservations = response.reservations;
            
            // カレンダーに反映
            this.calendarManager.setReservations(this.reservations);
            
        } catch (error) {
            console.error('予約の取得に失敗しました:', error);
            showErrorMessage('予約の取得に失敗しました', document.querySelector('#sidebar-message'));
        }
    }

    // 過去の予約取得
    async loadPastReservations() {
        try {
            const today = new Date();
            const pastDate = new Date(today.getFullYear(), today.getMonth() - 3, 1); // 3ヶ月前
            
            // 今日を含まない過去の予定を取得（todayの前日まで）
            const yesterday = new Date(today);
            yesterday.setDate(today.getDate() - 1);
            
            const params = `?start_date=${getDateString(pastDate)}&end_date=${getDateString(yesterday)}`;
            const response = await get(`api/reservations.php${params}`);
            
            this.reservations = response.reservations;
            this.calendarManager.setReservations(this.reservations);
            
        } catch (error) {
            console.error('過去の予約の取得に失敗しました:', error);
            showErrorMessage('過去の予約の取得に失敗しました', document.querySelector('#sidebar-message'));
        }
    }

    // 範囲指定での過去の予約取得
    async loadPastReservationsWithRange(startYear, startMonth, endYear, endMonth) {
        try {
            // 開始日（指定月の1日）
            const startDate = new Date(startYear, startMonth - 1, 1);
            
            // 終了日（指定月の最終日）
            const endDate = new Date(endYear, endMonth, 0);
            
            const params = `?start_date=${getDateString(startDate)}&end_date=${getDateString(endDate)}`;
            const response = await get(`api/reservations.php${params}`);
            
            this.reservations = response.reservations;
            this.calendarManager.setReservations(this.reservations);
            
        } catch (error) {
            console.error('過去の予約の取得に失敗しました:', error);
            showErrorMessage('過去の予約の取得に失敗しました', document.querySelector('#sidebar-message'));
        }
    }

    // 新規予約モーダル表示
    showNewReservationModal(date = null) {
        if (!authManager.getLoginStatus().isLoggedIn) {
            showErrorMessage('ログインが必要です', document.querySelector('#sidebar-message'));
            return;
        }

        this.currentEditingReservation = null;
        
        const modal = document.getElementById('reservationModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalContent = document.getElementById('modalContent');
        
        modalTitle.textContent = '新規予約';
        
        // 日本時間を取得
        const now = this.getJapanTime();
        
        // デフォルト日時設定
        let defaultDate = date || now;
        let defaultStartTime;
        
        if (date && (date.getHours() === 0 && date.getMinutes() === 0)) {
            // 月間ビューでのセルクリック時（時刻が00:00の場合）は現在時刻を開始時間にセット
            defaultStartTime = this.adjustToBusinessHours(now);
        } else {
            // 週間ビューでのセルクリック時や新規予約ボタンクリック時
            defaultStartTime = date || this.adjustToBusinessHours(now);
        }
        
        // 終了時刻の設定（17時以降は18時固定、それ以外は1時間後）
        let defaultEndTime;
        if (defaultStartTime.getHours() >= 17) {
            defaultEndTime = new Date(defaultStartTime);
            defaultEndTime.setHours(18, 0, 0, 0);
        } else {
            defaultEndTime = new Date(defaultStartTime.getTime() + 60 * 60 * 1000); // 1時間後
        }
        
        // 15分単位に調整
        defaultStartTime = this.roundToQuarter(defaultStartTime);
        defaultEndTime = this.roundToQuarter(defaultEndTime);
        
        const form = this.createReservationForm({
            date: getDateString(defaultDate),
            start_hour: defaultStartTime.getHours(),
            start_minute: defaultStartTime.getMinutes(),
            end_hour: defaultEndTime.getHours(),
            end_minute: defaultEndTime.getMinutes(),
            title: '',
            description: '',
            is_company_wide: false
        });
        
        modalContent.innerHTML = '';
        modalContent.appendChild(form);
        
        showModal('reservationModal');
    }

    // 編集予約モーダル表示
    showEditReservationModal(reservation) {
        if (!authManager.canEditReservation(reservation)) {
            showErrorMessage('この予約を編集する権限がありません', document.querySelector('#sidebar-message'));
            return;
        }

        this.currentEditingReservation = reservation;
        
        const modal = document.getElementById('reservationModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalContent = document.getElementById('modalContent');
        
        modalTitle.textContent = '予約編集';
        
        const startTime = new Date(reservation.start_datetime);
        const endTime = new Date(reservation.end_datetime);
        
        const form = this.createReservationForm({
            date: reservation.date,
            start_hour: startTime.getHours(),
            start_minute: startTime.getMinutes(),
            end_hour: endTime.getHours(),
            end_minute: endTime.getMinutes(),
            title: reservation.title,
            description: reservation.description || '',
            is_company_wide: reservation.is_company_wide
        });
        
        modalContent.innerHTML = '';
        modalContent.appendChild(form);
        
        showModal('reservationModal');
    }

    // 予約フォーム作成
    createReservationForm(data) {
        const form = createElement('form');
        
        // エラーメッセージ表示エリア
        const errorContainer = createElement('div', 'error-container');
        form.appendChild(errorContainer);
        
        // タイトル
        const titleGroup = createElement('div', 'form-group');
        const titleLabel = createElement('label', '', 'タイトル');
        titleLabel.setAttribute('for', 'reservationTitle');
        const titleInput = createElement('input');
        titleInput.type = 'text';
        titleInput.id = 'reservationTitle';
        titleInput.value = data.title;
        titleInput.required = true;
        titleInput.maxLength = 50;
        titleGroup.appendChild(titleLabel);
        titleGroup.appendChild(titleInput);
        form.appendChild(titleGroup);
        
        // 日付
        const dateGroup = createElement('div', 'form-group');
        const dateLabel = createElement('label', '', '日付');
        dateLabel.setAttribute('for', 'reservationDate');
        const dateInput = createElement('input');
        dateInput.type = 'date';
        dateInput.id = 'reservationDate';
        dateInput.value = data.date;
        dateInput.required = true;
        dateGroup.appendChild(dateLabel);
        dateGroup.appendChild(dateInput);
        form.appendChild(dateGroup);
        
        // 開始時間
        const startTimeGroup = createElement('div', 'form-group');
        const startTimeLabel = createElement('label', '');
        startTimeLabel.innerHTML = '開始時刻 <span class="required"></span>';
        startTimeLabel.setAttribute('for', 'reservation-start-hour');
        
        const startTimeSelectGroup = createElement('div', 'time-select-group');
        
        // 開始時間（時）
        const startHourSelect = createElement('select');
        startHourSelect.id = 'reservation-start-hour';
        startHourSelect.name = 'start_hour';
        startHourSelect.required = true;
        for (let hour = 9; hour <= 17; hour++) {
            const option = createElement('option', '', hour);
            option.value = hour;
            if (hour == data.start_hour) option.selected = true;
            startHourSelect.appendChild(option);
        }
        
        const hourSeparator = createElement('span', 'time-separator', '時');
        
        // 開始時間（分）
        const startMinuteSelect = createElement('select');
        startMinuteSelect.id = 'reservation-start-minute';
        startMinuteSelect.name = 'start_minute';
        startMinuteSelect.required = true;
        [0, 15, 30, 45].forEach(minute => {
            const option = createElement('option', '', minute.toString().padStart(2, '0'));
            option.value = minute;
            if (minute == data.start_minute) option.selected = true;
            startMinuteSelect.appendChild(option);
        });
        
        const minuteSeparator = createElement('span', 'time-separator', '分');
        
        startTimeSelectGroup.appendChild(startHourSelect);
        startTimeSelectGroup.appendChild(hourSeparator);
        startTimeSelectGroup.appendChild(startMinuteSelect);
        startTimeSelectGroup.appendChild(minuteSeparator);
        
        startTimeGroup.appendChild(startTimeLabel);
        startTimeGroup.appendChild(startTimeSelectGroup);
        form.appendChild(startTimeGroup);
        
        // 開始時刻変更時の終了時刻自動設定
        const updateEndTime = () => {
            const startHour = parseInt(startHourSelect.value);
            const startMinute = parseInt(startMinuteSelect.value);
            
            let endHour, endMinute;
            if (startHour >= 17) {
                // 17時以降の場合は終了時刻を18時に設定
                endHour = 18;
                endMinute = 0;
            } else {
                // 通常は1時間後に設定
                endHour = startHour + 1;
                endMinute = startMinute;
            }
            
            endHourSelect.value = endHour;
            endMinuteSelect.value = endMinute;
            
        };
        
        startHourSelect.addEventListener('change', updateEndTime);
        startMinuteSelect.addEventListener('change', updateEndTime);
        
        // 終了時間
        const endTimeGroup = createElement('div', 'form-group');
        const endTimeLabel = createElement('label', '');
        endTimeLabel.innerHTML = '終了時刻 <span class="required"></span>';
        endTimeLabel.setAttribute('for', 'reservation-end-hour');
        
        const endTimeSelectGroup = createElement('div', 'time-select-group');
        
        // 終了時間（時）
        const endHourSelect = createElement('select');
        endHourSelect.id = 'reservation-end-hour';
        endHourSelect.name = 'end_hour';
        endHourSelect.required = true;
        for (let hour = 9; hour <= 18; hour++) {
            const option = createElement('option', '', hour);
            option.value = hour;
            if (hour == data.end_hour) option.selected = true;
            endHourSelect.appendChild(option);
        }
        
        const endHourSeparator = createElement('span', 'time-separator', '時');
        
        // 終了時間（分）
        const endMinuteSelect = createElement('select');
        endMinuteSelect.id = 'reservation-end-minute';
        endMinuteSelect.name = 'end_minute';
        endMinuteSelect.required = true;
        [0, 15, 30, 45].forEach(minute => {
            const option = createElement('option', '', minute.toString().padStart(2, '0'));
            option.value = minute;
            if (minute == data.end_minute) option.selected = true;
            endMinuteSelect.appendChild(option);
        });
        
        const endMinuteSeparator = createElement('span', 'time-separator', '分');
        
        endTimeSelectGroup.appendChild(endHourSelect);
        endTimeSelectGroup.appendChild(endHourSeparator);
        endTimeSelectGroup.appendChild(endMinuteSelect);
        endTimeSelectGroup.appendChild(endMinuteSeparator);
        
        endTimeGroup.appendChild(endTimeLabel);
        endTimeGroup.appendChild(endTimeSelectGroup);
        form.appendChild(endTimeGroup);
        
        // 詳細
        const descriptionGroup = createElement('div', 'form-group');
        const descriptionLabel = createElement('label', '', '詳細');
        descriptionLabel.setAttribute('for', 'reservationDescription');
        const descriptionInput = createElement('textarea');
        descriptionInput.id = 'reservationDescription';
        descriptionInput.value = data.description;
        descriptionInput.maxLength = 300;
        descriptionInput.placeholder = '会議の詳細を入力してください（任意）';
        descriptionGroup.appendChild(descriptionLabel);
        descriptionGroup.appendChild(descriptionInput);
        form.appendChild(descriptionGroup);
        
        // 全社共通フラグ
        const companyWideGroup = createElement('div', 'form-group');
        const companyWideLabel = createElement('label');
        const companyWideInput = createElement('input');
        companyWideInput.type = 'checkbox';
        companyWideInput.id = 'reservationCompanyWide';
        companyWideInput.checked = data.is_company_wide;
        companyWideLabel.appendChild(companyWideInput);
        companyWideLabel.appendChild(document.createTextNode('全社共通の予約'));
        companyWideGroup.appendChild(companyWideLabel);
        form.appendChild(companyWideGroup);
        
        // ボタン
        const actions = createElement('div', 'form-actions');
        
        const submitBtn = createElement('button', '', this.currentEditingReservation ? '更新' : '作成');
        submitBtn.type = 'submit';
        
        const cancelBtn = createElement('button', '', 'キャンセル');
        cancelBtn.type = 'button';
        cancelBtn.setAttribute('commandfor', 'reservationModal');
        cancelBtn.setAttribute('command', 'close');
        
        actions.appendChild(submitBtn);
        actions.appendChild(cancelBtn);
        form.appendChild(actions);
        
        // フォーム送信イベント
        form.addEventListener('submit', (e) => this.handleFormSubmit(e));
        
        return form;
    }

    // フォーム送信処理
    async handleFormSubmit(event) {
        event.preventDefault();
        
        const formData = this.getFormData(event.target);
        
        // バリデーション
        const validation = this.validateFormData(formData);
        if (!validation.valid) {
            showErrorMessage(validation.message, event.target.querySelector('.error-container'));
            return;
        }
        
        // 土日チェック
        if (!this.validateWeekday(formData.date)) {
            showErrorMessage('土日の予約はできません', event.target.querySelector('.error-container'));
            return;
        }
        
        // 重複チェック
        try {
            const dateReservations = await this.getReservationsForConflictCheck(formData.date);
            const excludeId = this.currentEditingReservation ? this.currentEditingReservation.id : null;
            const hasConflict = this.checkTimeConflict(
                formData.start_datetime, 
                formData.end_datetime, 
                dateReservations, 
                excludeId
            );
            
            if (hasConflict) {
                showErrorMessage('指定の時間帯は既に予約されています', event.target.querySelector('.error-container'));
                return;
            }
        } catch (error) {
            console.error('重複チェックに失敗しました:', error);
            showErrorMessage('重複チェックに失敗しました', event.target.querySelector('.error-container'));
            return;
        }
        
        const submitBtn = event.target.querySelector('button[type="submit"]');
        const hideLoading = showLoading(submitBtn);
        
        try {
            if (this.currentEditingReservation) {
                await this.updateReservation(this.currentEditingReservation.id, formData);
            } else {
                await this.createReservation(formData);
            }
            
            hideModal('reservationModal');
            await this.loadReservations();
            
        } catch (error) {
            showErrorMessage(error.message, event.target.querySelector('.error-container'));
        } finally {
            hideLoading();
        }
    }

    // フォームデータ取得
    getFormData(form) {
        const data = {};
        
        data.title = form.querySelector('#reservationTitle').value.trim();
        data.date = form.querySelector('#reservationDate').value;
        
        // select要素から時間・分を取得
        const startHour = form.querySelector('#reservation-start-hour').value;
        const startMinute = form.querySelector('#reservation-start-minute').value;
        const endHour = form.querySelector('#reservation-end-hour').value;
        const endMinute = form.querySelector('#reservation-end-minute').value;
        
        data.description = form.querySelector('#reservationDescription').value.trim();
        data.is_company_wide = form.querySelector('#reservationCompanyWide').checked;
        
        // 時間文字列を作成
        data.start_time = `${startHour.padStart(2, '0')}:${startMinute.padStart(2, '0')}`;
        data.end_time = `${endHour.padStart(2, '0')}:${endMinute.padStart(2, '0')}`;
        
        // 日時文字列を作成
        data.start_datetime = `${data.date}T${data.start_time}:00`;
        data.end_datetime = `${data.date}T${data.end_time}:00`;
        
        return data;
    }

    // フォームデータバリデーション（送信時の完全チェック）
    validateFormData(data) {
        // 必須項目チェック
        if (!validateRequired(data.title)) {
            return { valid: false, message: 'タイトルは必須です' };
        }
        
        if (!validateRequired(data.date)) {
            return { valid: false, message: '日付は必須です' };
        }
        
        if (!validateRequired(data.start_time)) {
            return { valid: false, message: '開始時間は必須です' };
        }
        
        if (!validateRequired(data.end_time)) {
            return { valid: false, message: '終了時間は必須です' };
        }
        
        // 文字数チェック
        if (!validateLength(data.title, 1, 50)) {
            return { valid: false, message: 'タイトルは1文字以上50文字以下で入力してください' };
        }
        
        if (data.description && !validateLength(data.description, 0, 300)) {
            return { valid: false, message: '詳細は300文字以下で入力してください' };
        }
        
        // 時間バリデーション
        const timeValidation = validateReservationTime(data.start_datetime, data.end_datetime);
        if (!timeValidation.valid) {
            return { valid: false, message: timeValidation.message };
        }
        
        return { valid: true };
    }


    // 予約作成
    async createReservation(data) {
        console.log('送信データ:', data); // デバッグ用
        const response = await post('api/reservations.php', data);
        showSuccessMessage('予約を作成しました', document.querySelector('#sidebar-message'));
        
        // 成功後にメール送信
        if (response.reservation) {
            sendReservationEmail(response.reservation, 'created');
        }
        
        return response;
    }

    // 予約更新
    async updateReservation(id, data) {
        const response = await put('api/reservations.php', { id, ...data });
        showSuccessMessage('予約を更新しました', document.querySelector('#sidebar-message'));
        
        // 成功後にメール送信
        if (response.reservation) {
            sendReservationEmail(response.reservation, 'updated');
        }
        
        return response;
    }

    // 予約削除
    async deleteReservation(id) {
        try {
            // 削除前に予約データを保存（メール送信用）
            const reservationToDelete = this.getReservation(id);
            if (!reservationToDelete) {
                throw new Error('予約が見つかりません');
            }
            
            // 削除APIリクエスト
            await del('api/reservations.php', { id });
            
            // 削除成功後にモーダルクローズとカレンダー更新を同時実行
            hideModal('reservationModal');
            
            
            // 削除成功後にメール送信
            sendReservationEmail(reservationToDelete, 'deleted');
            
            // カレンダー更新
            await this.loadReservations();
            showSuccessMessage('予約を削除しました', document.querySelector('#sidebar-message'));
        } catch (error) {
            showErrorMessage(error.message, document.querySelector('#sidebar-message'));
        }
    }

    // 週の最初の日を取得
    getFirstDayOfWeek(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.setDate(diff));
    }

    // 週の最後の日を取得
    getLastDayOfWeek(date) {
        const firstDay = this.getFirstDayOfWeek(date);
        return new Date(firstDay.getTime() + 6 * 24 * 60 * 60 * 1000);
    }

    // 日本時間取得
    getJapanTime() {
        const now = new Date();
        // JST (UTC+9)
        const jstOffset = 9 * 60 * 60 * 1000;
        const utc = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
        return new Date(utc + jstOffset);
    }

    // 営業時間内に調整
    adjustToBusinessHours(date) {
        const adjustedDate = new Date(date);
        const hours = adjustedDate.getHours();
        
        if (hours < 9) {
            adjustedDate.setHours(9, 0, 0, 0);
        } else if (hours >= 18) {
            adjustedDate.setHours(17, 0, 0, 0);
        }
        
        return adjustedDate;
    }

    // 15分単位に丸める
    roundToQuarter(date) {
        const roundedDate = new Date(date);
        const minutes = roundedDate.getMinutes();
        const roundedMinutes = Math.round(minutes / 15) * 15;
        
        if (roundedMinutes === 60) {
            roundedDate.setHours(roundedDate.getHours() + 1, 0, 0, 0);
        } else {
            roundedDate.setMinutes(roundedMinutes, 0, 0);
        }
        
        return roundedDate;
    }

    // 重複チェック用の予約データ取得（特定の日付の予約を取得）
    async getReservationsForConflictCheck(date) {
        try {
            const dateStr = typeof date === 'string' ? date : this.getDateString(date);
            const response = await get(`api/reservations.php?start_date=${dateStr}&end_date=${dateStr}`);
            return response.reservations || [];
        } catch (error) {
            console.error('重複チェック用予約データの取得に失敗しました:', error);
            return [];
        }
    }

    // 日付文字列を取得するヘルパー関数
    getDateString(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // 時間重複チェック
    checkTimeConflict(newStart, newEnd, existingReservations, excludeId = null) {
        const newStartTime = new Date(newStart);
        const newEndTime = new Date(newEnd);
        
        return existingReservations.some(reservation => {
            // 編集時は自分の予約を除外
            if (excludeId && reservation.id == excludeId) {
                return false;
            }
            
            const existingStart = new Date(reservation.start_datetime);
            const existingEnd = new Date(reservation.end_datetime);
            
            // 重複チェック：新規予約の開始時刻が既存予約の終了時刻より前かつ、
            // 新規予約の終了時刻が既存予約の開始時刻より後の場合に重複
            return newStartTime < existingEnd && newEndTime > existingStart;
        });
    }


    // 予約データ取得
    getReservations() {
        return this.reservations;
    }

    // 土日チェック
    validateWeekday(dateString) {
        const date = new Date(dateString);
        const dayOfWeek = date.getDay(); // 0=日曜日, 6=土曜日
        return dayOfWeek >= 1 && dayOfWeek <= 5; // 月曜日（1）から金曜日（5）のみ
    }

    // 特定の予約取得
    getReservation(id) {
        return this.reservations.find(r => r.id === id);
    }
}

export default ReservationManager;