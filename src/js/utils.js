// 共通ユーティリティ関数

// API通信関数
export async function apiRequest(url, options = {}) {
    const defaultOptions = {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include'
    };
    
    const config = { ...defaultOptions, ...options };
    
    try {
        const response = await fetch(url, config);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('API request failed:', error);
        throw error;
    }
}

// GET リクエスト
export async function get(url) {
    return apiRequest(url);
}

// POST リクエスト
export async function post(url, data) {
    return apiRequest(url, {
        method: 'POST',
        body: JSON.stringify(data)
    });
}

// PUT リクエスト
export async function put(url, data) {
    return apiRequest(url, {
        method: 'PUT',
        body: JSON.stringify(data)
    });
}

// DELETE リクエスト
export async function del(url, data = {}) {
    return apiRequest(url, {
        method: 'DELETE',
        body: JSON.stringify(data)
    });
}

// 日付処理関数
export function formatDate(date) {
    return new Date(date).toLocaleDateString('ja-JP');
}

export function formatTime(datetime) {
    return new Date(datetime).toLocaleTimeString('ja-JP', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

export function formatDateTime(datetime) {
    const date = new Date(datetime);
    return date.toLocaleDateString('ja-JP') + ' ' + date.toLocaleTimeString('ja-JP', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

// 日付文字列を取得（YYYY-MM-DD形式）
export function getDateString(date) {
    return date.toISOString().split('T')[0];
}

// 日時文字列を取得（YYYY-MM-DDTHH:MM形式）
export function getDateTimeString(date) {
    return date.toISOString().slice(0, 16);
}

// 今日の日付を取得
export function getToday() {
    return new Date();
}

// 月の最初の日を取得
export function getFirstDayOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

// 月の最後の日を取得
export function getLastDayOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

// 週の最初の日（月曜日）を取得
export function getFirstDayOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
}

// 週の最後の日（日曜日）を取得
export function getLastDayOfWeek(date) {
    const firstDay = getFirstDayOfWeek(date);
    return new Date(firstDay.getTime() + 6 * 24 * 60 * 60 * 1000);
}

// 営業日かどうかチェック
export function isBusinessDay(date) {
    const day = date.getDay();
    return day !== 0 && day !== 6; // 日曜日と土曜日以外
}

// 営業時間かどうかチェック
export function isBusinessHours(date) {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    
    // 9:00-18:00の範囲
    if (hours < 9 || hours >= 18) {
        return false;
    }
    
    // 15分単位
    if (minutes % 15 !== 0) {
        return false;
    }
    
    return true;
}

// 時間を15分単位に丸める
export function roundToQuarter(date) {
    const minutes = date.getMinutes();
    const roundedMinutes = Math.round(minutes / 15) * 15;
    const result = new Date(date);
    result.setMinutes(roundedMinutes);
    result.setSeconds(0);
    result.setMilliseconds(0);
    return result;
}

// バリデーション関数
export function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

export function validateRequired(value) {
    return value !== null && value !== undefined && value.toString().trim() !== '';
}

export function validateLength(value, min, max) {
    if (!validateRequired(value)) return false;
    const length = value.toString().trim().length;
    return length >= min && length <= max;
}

export function validateReservationTime(startTime, endTime) {
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    // 開始時間が終了時間より前
    if (start >= end) {
        return { valid: false, message: '終了時間は開始時間より後である必要があります' };
    }
    
    // 営業日チェック
    if (!isBusinessDay(start) || !isBusinessDay(end)) {
        return { valid: false, message: '予約は平日のみ可能です' };
    }
    
    // 営業時間チェック
    if (!isBusinessHours(start) || !isBusinessHours(end)) {
        return { valid: false, message: '予約は9:00-18:00の間で15分単位で行ってください' };
    }
    
    return { valid: true };
}

// DOM操作ヘルパー関数
export function createElement(tag, className = '', textContent = '') {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (textContent) element.textContent = textContent;
    return element;
}

export function clearElement(element) {
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }
}

export function showElement(element) {
    element.style.display = 'block';
}

export function hideElement(element) {
    element.style.display = 'none';
}

export function toggleElement(element) {
    element.style.display = element.style.display === 'none' ? 'block' : 'none';
}

// エラーメッセージ表示
export function showErrorMessage(message, container) {
    const errorDiv = createElement('div', 'error-message', message);
    container.insertBefore(errorDiv, container.firstChild);
    
    // 5秒後に自動削除
    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.parentNode.removeChild(errorDiv);
        }
    }, 5000);
}

// 成功メッセージ表示
export function showSuccessMessage(message, container) {
    const successDiv = createElement('div', 'success-message', message);
    container.insertBefore(successDiv, container.firstChild);
    
    // 3秒後に自動削除
    setTimeout(() => {
        if (successDiv.parentNode) {
            successDiv.parentNode.removeChild(successDiv);
        }
    }, 3000);
}

// ローディング表示
export function showLoading(button) {
    const originalText = button.textContent;
    button.textContent = '';
    button.disabled = true;
    
    const loadingSpinner = createElement('span', 'loading');
    button.appendChild(loadingSpinner);
    
    return () => {
        button.textContent = originalText;
        button.disabled = false;
    };
}

// 確認ダイアログ
export function confirm(message) {
    return new Promise((resolve) => {
        const result = window.confirm(message);
        resolve(result);
    });
}

// モーダル操作
export function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'block';
    }
}

export function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

// カラーコード変換
export function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

export function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

// 部署カラー取得
export function getDepartmentColor(department, userColorSettings = {}) {
    if (userColorSettings[department.id]) {
        return userColorSettings[department.id];
    }
    return department.default_color || '#718096';
}

// デバウンス関数
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// スロットル関数
export function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// localStorage操作
export function setStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.error('Failed to save to localStorage:', error);
    }
}

export function getStorage(key, defaultValue = null) {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
        console.error('Failed to get from localStorage:', error);
        return defaultValue;
    }
}

export function removeStorage(key) {
    try {
        localStorage.removeItem(key);
    } catch (error) {
        console.error('Failed to remove from localStorage:', error);
    }
}

// 現在の時刻を営業時間内に調整
export function adjustToBusinessHours(date = new Date()) {
    const result = new Date(date);
    
    // 営業日でない場合は次の営業日に調整
    while (!isBusinessDay(result)) {
        result.setDate(result.getDate() + 1);
    }
    
    // 営業時間外の場合は9:00に調整
    if (result.getHours() < 9) {
        result.setHours(9, 0, 0, 0);
    } else if (result.getHours() >= 18) {
        result.setDate(result.getDate() + 1);
        result.setHours(9, 0, 0, 0);
        // 再帰的に営業日チェック
        return adjustToBusinessHours(result);
    }
    
    // 15分単位に調整
    return roundToQuarter(result);
}