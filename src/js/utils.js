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
            let errorMessage = `HTTP error! status: ${response.status}`;
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorMessage;
            } catch (jsonError) {
                // JSONパースエラーの場合はHTMLレスポンスの可能性
                const textResponse = await response.text();
                if (textResponse.includes('<!DOCTYPE')) {
                    errorMessage = 'Server error: Invalid response format';
                } else {
                    errorMessage = textResponse;
                }
            }
            throw new Error(errorMessage);
        }
        
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        } else {
            // HTMLレスポンスなどの場合
            const text = await response.text();
            throw new Error('Invalid response format: ' + text.substring(0, 100));
        }
    } catch (error) {
        if (error.name === 'SyntaxError') {
            // JSONパースエラー
            throw new Error('Invalid JSON response from server');
        }
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

export function formatDateJapanese(date) {
    const d = new Date(date);
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
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
    // ローカルタイムゾーンでYYYY-MM-DD形式を取得
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// 日時文字列を取得（YYYY-MM-DDTHH:MM形式）
export function getDateTimeString(date) {
    // ローカルタイムゾーンでYYYY-MM-DDTHH:MM形式を取得
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
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
    if (hours < 9 || hours > 18) {
        return false;
    }

    // 18時の場合は00分のみ許可
    if (hours === 18 && minutes !== 0) {
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
        return { valid: false, message: '予約は9:00-18:00の間で行ってください' };
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
    console.log('Success:', message);
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
    if (modal && modal.tagName === 'DIALOG') {
        modal.showModal();
    }
}

export function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal && modal.tagName === 'DIALOG') {
        modal.close();
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

// WCAG相対輝度を計算
function getRelativeLuminance(r, g, b) {
    // RGB値を0-1の範囲に正規化
    const rsRGB = r / 255;
    const gsRGB = g / 255;
    const bsRGB = b / 255;
    
    // ガンマ補正
    const rLinear = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
    const gLinear = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
    const bLinear = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4);
    
    // 相対輝度計算
    return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
}

// コントラスト比を計算
function getContrastRatio(luminance1, luminance2) {
    const lighter = Math.max(luminance1, luminance2);
    const darker = Math.min(luminance1, luminance2);
    return (lighter + 0.05) / (darker + 0.05);
}

// WCAG 4.5:1基準で適切な文字色を返す関数
export function getContrastColor(backgroundColor, departmentName = '') {
    // 色をRGBに変換
    const rgb = hexToRgb(backgroundColor);
    if (!rgb) return '#000'; // 変換失敗時はデフォルト黒
    
    // 背景色の相対輝度を計算
    const bgLuminance = getRelativeLuminance(rgb.r, rgb.g, rgb.b);
    
    // 白（#FFF）と黒（#000）の相対輝度
    const whiteLuminance = 1; // 白の相対輝度は1
    const blackLuminance = 0; // 黒の相対輝度は0
    
    // それぞれのコントラスト比を計算
    const whiteContrast = getContrastRatio(bgLuminance, whiteLuminance);
    const blackContrast = getContrastRatio(bgLuminance, blackLuminance);
    
    // WCAG AA基準（4.5:1）検証用で変更
    const wcagThreshold = 4.5;
    
    const selectedColor = whiteContrast >= wcagThreshold && blackContrast >= wcagThreshold ? '#FFF' : 
                         whiteContrast > blackContrast ? '#FFF' : '#000';
    
    // コンソール出力
    // console.log(`${departmentName ? `[${departmentName}] ` : ''}背景色: ${backgroundColor}, 白コントラスト: ${whiteContrast.toFixed(2)}, 黒コントラスト: ${blackContrast.toFixed(2)}, 選択色: ${selectedColor}`);
    
    return selectedColor;
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