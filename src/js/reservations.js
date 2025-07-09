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
    clearElement
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

        // モーダルの閉じるボタン
        const closeBtn = document.querySelector('#reservationModal .close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => hideModal('reservationModal'));
        }

        // モーダル外クリックで閉じる
        const modal = document.getElementById('reservationModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    hideModal('reservationModal');
                }
            });
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
                params = '?view_type=list';
            }
            
            const response = await get(`/api/reservations.php${params}`);
            this.reservations = response.reservations;
            
            // カレンダーに反映
            this.calendarManager.setReservations(this.reservations);
            
        } catch (error) {
            console.error('予約の取得に失敗しました:', error);
            showErrorMessage('予約の取得に失敗しました', document.querySelector('.main-content'));
        }
    }

    // 過去の予約取得
    async loadPastReservations() {
        try {
            const today = new Date();
            const pastDate = new Date(today.getFullYear(), today.getMonth() - 3, 1); // 3ヶ月前
            
            const params = `?start_date=${getDateString(pastDate)}&end_date=${getDateString(today)}`;
            const response = await get(`/api/reservations.php${params}`);
            
            this.reservations = response.reservations;
            this.calendarManager.setReservations(this.reservations);
            
        } catch (error) {
            console.error('過去の予約の取得に失敗しました:', error);
            showErrorMessage('過去の予約の取得に失敗しました', document.querySelector('.main-content'));
        }
    }

    // 新規予約モーダル表示
    showNewReservationModal(date = null) {
        if (!authManager.getLoginStatus().isLoggedIn) {
            showErrorMessage('ログインが必要です', document.querySelector('.main-content'));
            return;
        }

        this.currentEditingReservation = null;
        
        const modal = document.getElementById('reservationModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalContent = document.getElementById('modalContent');
        
        modalTitle.textContent = '新規予約';
        
        // デフォルト日時設定
        let defaultDate = date || new Date();
        let defaultStartTime = date || adjustToBusinessHours();
        let defaultEndTime = new Date(defaultStartTime.getTime() + 60 * 60 * 1000); // 1時間後
        
        // 15分単位に調整
        defaultStartTime = roundToQuarter(defaultStartTime);
        defaultEndTime = roundToQuarter(defaultEndTime);
        
        const form = this.createReservationForm({
            date: getDateString(defaultDate),
            start_time: getDateTimeString(defaultStartTime).substring(11, 16),
            end_time: getDateTimeString(defaultEndTime).substring(11, 16),
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
            showErrorMessage('この予約を編集する権限がありません', document.querySelector('.main-content'));
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
            start_time: startTime.toTimeString().substring(0, 5),
            end_time: endTime.toTimeString().substring(0, 5),
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
        const startTimeLabel = createElement('label', '', '開始時間');
        startTimeLabel.setAttribute('for', 'reservationStartTime');
        const startTimeInput = createElement('input');
        startTimeInput.type = 'time';
        startTimeInput.id = 'reservationStartTime';
        startTimeInput.value = data.start_time;
        startTimeInput.step = 900; // 15分刻み
        startTimeInput.required = true;
        startTimeGroup.appendChild(startTimeLabel);
        startTimeGroup.appendChild(startTimeInput);
        form.appendChild(startTimeGroup);
        
        // 終了時間
        const endTimeGroup = createElement('div', 'form-group');
        const endTimeLabel = createElement('label', '', '終了時間');
        endTimeLabel.setAttribute('for', 'reservationEndTime');
        const endTimeInput = createElement('input');
        endTimeInput.type = 'time';
        endTimeInput.id = 'reservationEndTime';
        endTimeInput.value = data.end_time;
        endTimeInput.step = 900; // 15分刻み
        endTimeInput.required = true;
        endTimeGroup.appendChild(endTimeLabel);
        endTimeGroup.appendChild(endTimeInput);
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
        cancelBtn.addEventListener('click', () => hideModal('reservationModal'));
        
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
        const formData = new FormData(form);
        const data = {};
        
        data.title = form.querySelector('#reservationTitle').value.trim();
        data.date = form.querySelector('#reservationDate').value;
        data.start_time = form.querySelector('#reservationStartTime').value;
        data.end_time = form.querySelector('#reservationEndTime').value;
        data.description = form.querySelector('#reservationDescription').value.trim();
        data.is_company_wide = form.querySelector('#reservationCompanyWide').checked;
        
        // 日時文字列を作成
        data.start_datetime = `${data.date}T${data.start_time}:00`;
        data.end_datetime = `${data.date}T${data.end_time}:00`;
        
        return data;
    }

    // フォームデータバリデーション
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
        const response = await post('/api/reservations.php', data);
        showSuccessMessage('予約を作成しました', document.querySelector('.main-content'));
        return response;
    }

    // 予約更新
    async updateReservation(id, data) {
        const response = await put('/api/reservations.php', { id, ...data });
        showSuccessMessage('予約を更新しました', document.querySelector('.main-content'));
        return response;
    }

    // 予約削除
    async deleteReservation(id) {
        const confirmed = await confirm('この予約を削除してもよろしいですか？');
        if (!confirmed) return;
        
        try {
            await del('/api/reservations.php', { id });
            showSuccessMessage('予約を削除しました', document.querySelector('.main-content'));
            hideModal('reservationModal');
            await this.loadReservations();
        } catch (error) {
            showErrorMessage(error.message, document.querySelector('.main-content'));
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

    // 予約データ取得
    getReservations() {
        return this.reservations;
    }

    // 特定の予約取得
    getReservation(id) {
        return this.reservations.find(r => r.id === id);
    }
}

export default ReservationManager;