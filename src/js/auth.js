// 認証関連の機能

import { get, post, put, showErrorMessage, showSuccessMessage, showLoading } from './utils.js';

class AuthManager {
    constructor() {
        this.currentUser = null;
        this.isLoggedIn = false;
        this.isAdmin = false;
        this.departments = [];
        this.userColorSettings = {};
        this.companyDefaultColor = '#3498db';
        this.initialized = false;
        this.init();
    }

    async init() {
        if (this.initialized) {
            return;
        }
        
        await this.checkAuthStatus();
        await this.loadDepartments();
        await this.loadCompanyColor();
        this.setupEventListeners();
        this.initialized = true;
    }

    // 認証状態確認
    async checkAuthStatus() {
        try {
            const response = await get('api/auth.php?action=status');
            this.isLoggedIn = response.loggedIn;
            this.isAdmin = Boolean(response.admin); // 明示的にbooleanに変換
            this.currentUser = response.user;
            
            
            if (this.currentUser && this.currentUser.color_setting) {
                const parsedSettings = JSON.parse(this.currentUser.color_setting);
                
                // 配列形式の場合はオブジェクト形式に変換
                if (Array.isArray(parsedSettings)) {
                    this.userColorSettings = this.convertArrayToObjectSettings(parsedSettings);
                } else {
                    this.userColorSettings = parsedSettings;
                }
            } else {
                this.userColorSettings = {};
            }
            
            this.updateUI();
        } catch (error) {
            console.error('認証状態の確認に失敗しました:', error);
            this.isLoggedIn = false;
            this.isAdmin = false;
            this.currentUser = null;
            this.userColorSettings = {};
            this.updateUI();
        }
    }

    // 部署一覧取得
    async loadDepartments() {
        try {
            const response = await get('api/departments.php');
            this.departments = response.departments;
            
            // ログイン状態に応じてUIを更新
            if (this.isLoggedIn) {
                this.updateColorSettings();
            } else {
                this.updateColorInfo();
            }
        } catch (error) {
            console.error('部署情報の取得に失敗しました:', error);
        }
    }

    // 全社のデフォルトカラー取得
    async loadCompanyColor() {
        try {
            // console.log('全社カラー設定を取得します');
            const response = await get('api/company-color.php');
            // console.log('全社カラー設定の取得結果:', response);
            this.companyDefaultColor = response.color || '#3498db';
            
            // ログイン状態に応じてUIを更新
            if (this.isLoggedIn) {
                this.updateColorSettings();
            } else {
                this.updateColorInfo();
            }
        } catch (error) {
            console.error('全社カラー設定の取得に失敗しました:', error);
        }
    }

    // イベントリスナー設定
    setupEventListeners() {
        // console.log('AuthManager: イベントリスナーを設定します');
        
        // 既存のイベントリスナーをクリア
        this.clearEventListeners();
        
        // ログインフォーム
        const loginForm = document.querySelector('#loginForm form');
        if (loginForm) {
            this.loginHandler = (e) => this.handleLogin(e);
            loginForm.addEventListener('submit', this.loginHandler);
        }

        // ログアウトボタン
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            this.logoutHandler = () => this.handleLogout();
            logoutBtn.addEventListener('click', this.logoutHandler);
        }

        // カラー設定
        const colorSettings = document.getElementById('colorSettings');
        if (colorSettings) {
            this.colorChangeHandler = (e) => this.handleColorChange(e);
            colorSettings.addEventListener('change', this.colorChangeHandler);
        }
    }

    // イベントリスナーをクリア
    clearEventListeners() {
        // ログインフォーム
        const loginForm = document.querySelector('#loginForm form');
        if (loginForm && this.loginHandler) {
            loginForm.removeEventListener('submit', this.loginHandler);
        }

        // ログアウトボタン
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn && this.logoutHandler) {
            logoutBtn.removeEventListener('click', this.logoutHandler);
        }

        // カラー設定
        const colorSettings = document.getElementById('colorSettings');
        if (colorSettings && this.colorChangeHandler) {
            colorSettings.removeEventListener('change', this.colorChangeHandler);
        }
    }

    // ログイン処理
    async handleLogin(event) {
        event.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        if (!email || !password) {
            showErrorMessage('メールアドレスとパスワードを入力してください。', document.querySelector('#sidebar-message'));
            return;
        }

        const submitBtn = event.target.querySelector('button[type="submit"]');
        const hideLoading = showLoading(submitBtn);

        try {
            const response = await post('api/auth.php?action=login', {
                email: email,
                password: password
            });

            this.currentUser = response.user;
            this.isLoggedIn = true;
            this.isAdmin = Boolean(response.user.admin);
            
            if (this.currentUser.color_setting) {
                const parsedSettings = JSON.parse(this.currentUser.color_setting);
                // 配列形式の場合はオブジェクト形式に変換
                if (Array.isArray(parsedSettings)) {
                    this.userColorSettings = this.convertArrayToObjectSettings(parsedSettings);
                } else {
                    this.userColorSettings = parsedSettings;
                }
            }

            showSuccessMessage('ログインしました', document.querySelector('#sidebar-message'));
            
            // フォームをリセット
            event.target.reset();
            
            // UI更新
            this.updateUI();
            
            // メインコンテンツ更新
            if (window.reservationManager) {
                window.reservationManager.loadReservations();
            }

        } catch (error) {
            showErrorMessage(error.message, document.querySelector('#sidebar-message'));
        } finally {
            hideLoading();
        }
    }

    // ログアウト処理
    async handleLogout() {
        try {
            await post('api/auth.php?action=logout');
            
            this.currentUser = null;
            this.isLoggedIn = false;
            this.isAdmin = false;
            this.userColorSettings = {};
            
            showSuccessMessage('ログアウトしました', document.querySelector('#sidebar-message'));
            
            // UI更新
            this.updateUI();
            
            // メインコンテンツ更新
            if (window.reservationManager) {
                window.reservationManager.loadReservations();
            }

            // 認証状態変更の通知
            if (this.onAuthStateChanged) {
                this.onAuthStateChanged();
            }

        } catch (error) {
            showErrorMessage(error.message, document.querySelector('#sidebar-message'));
        }
    }

    // カラー設定変更
    async handleColorChange(event) {
        if (event.target.type === 'color') {
            const departmentId = event.target.dataset.departmentId;
            const color = event.target.value;
            
            this.userColorSettings[departmentId] = color;
            
            try {
                await put('api/users.php?action=colors', {
                    color_settings: this.userColorSettings
                });
                
                // カレンダー再描画
                if (window.calendarManager) {
                    window.calendarManager.render();
                }
                
            } catch (error) {
                showErrorMessage('カラー設定の保存に失敗しました', document.querySelector('#sidebar-message'));
            }
        }
    }

    // UI更新
    updateUI() {
        const loginForm = document.getElementById('loginForm');
        const userInfo = document.getElementById('userInfo');
        const userName = document.getElementById('userName');
        const userDepartment = document.getElementById('userDepartment');
        const userRole = document.getElementById('userRole');
        const actionButtons = document.getElementById('actionButtons');
        const colorSettingsSection = document.querySelector('.color-settings');
        const colorSettings = document.getElementById('colorSettings');
        const colorInfo = document.getElementById('colorInfo');

        if (this.isLoggedIn && this.currentUser) {
            // ログイン済み表示
            if (loginForm) loginForm.style.display = 'none';
            if (userInfo) userInfo.style.display = 'block';
            if (userName) userName.textContent = this.currentUser.name;
            if (userDepartment) userDepartment.textContent = this.currentUser.department_name;
            
            // 管理者権限表示
            if (userRole) {
                if (this.isAdmin) {
                    userRole.textContent = '管理者';
                    userRole.style.display = 'block';
                    userRole.style.color = '#e74c3c';
                    userRole.style.fontWeight = 'bold';
                } else {
                    userRole.style.display = 'none';
                }
            }
            
            if (actionButtons) actionButtons.style.display = 'block';
            
            // ログイン時：colorSettingsを表示、colorInfoを非表示
            if (colorSettings) {
                colorSettings.style.display = 'block';
                this.updateColorSettings();
            }
            if (colorInfo) {
                colorInfo.style.display = 'none';
            }
        } else {
            // 未ログイン表示
            if (loginForm) loginForm.style.display = 'block';
            if (userInfo) userInfo.style.display = 'none';
            if (actionButtons) actionButtons.style.display = 'none';
            
            // 非ログイン時：colorInfoを表示、colorSettingsを非表示
            if (colorSettings) {
                colorSettings.style.display = 'none';
            }
            if (colorInfo) {
                colorInfo.style.display = 'block';
                this.updateColorInfo();
            }
        }
        
        // color-settingsセクションは常に表示
        if (colorSettingsSection) {
            colorSettingsSection.style.display = 'block';
        }

        // 管理者メニュー
        this.updateAdminMenu();
    }

    // 管理者メニュー更新
    updateAdminMenu() {
        // 管理者メニューの表示/非表示
        const adminMenu = document.getElementById('adminMenu');
        if (adminMenu) {
            adminMenu.style.display = this.isAdmin ? 'inline' : 'none';
        }
    }

    // カラー設定UI更新
    updateColorSettings() {
        const colorSettings = document.getElementById('colorSettings');
        if (!colorSettings) return;

        colorSettings.innerHTML = '';

        // 全社の項目を一番上に追加（個人設定）
        const companyColorItem = document.createElement('div');
        companyColorItem.className = 'color-item';
        
        const companyLabel = document.createElement('label');
        companyLabel.textContent = '全社';
        
        const companyColorInput = document.createElement('input');
        companyColorInput.type = 'color';
        companyColorInput.value = this.userColorSettings['company'] || this.companyDefaultColor;
        companyColorInput.dataset.departmentId = 'company';
        
        companyColorItem.appendChild(companyLabel);
        companyColorItem.appendChild(companyColorInput);
        colorSettings.appendChild(companyColorItem);

        // 各部署の項目を追加
        this.departments.forEach(department => {
            const colorItem = document.createElement('div');
            colorItem.className = 'color-item';
            
            const label = document.createElement('label');
            label.textContent = department.name;
            
            const colorInput = document.createElement('input');
            colorInput.type = 'color';
            colorInput.value = this.userColorSettings[department.id] || department.default_color;
            colorInput.dataset.departmentId = department.id;
            
            colorItem.appendChild(label);
            colorItem.appendChild(colorInput);
            colorSettings.appendChild(colorItem);
        });

        // デフォルトに戻すボタンを追加
        const resetButtonContainer = document.createElement('div');
        resetButtonContainer.style.marginTop = '1rem';
        resetButtonContainer.style.textAlign = 'center';
        
        const resetButton = document.createElement('button');
        resetButton.id = 'resetBtn';
        resetButton.className = 'sidebar-btn';
        resetButton.innerHTML = '<img src="/meeting-room-reservation-09/src/images/refresh.svg" alt="" class="material-icon"><span class="sidebar-btn-text">デフォルトに戻す</span>';
        resetButton.addEventListener('click', () => this.resetColorsToDefault());
        
        resetButtonContainer.appendChild(resetButton);
        colorSettings.appendChild(resetButtonContainer);
    }

    // カラー情報表示（非ログイン時）
    updateColorInfo() {
        const colorInfo = document.getElementById('colorInfo');
        if (!colorInfo) return;

        colorInfo.innerHTML = '';

        // 全社の項目を一番上に追加（デフォルト値のみ表示）
        const companyColorItem = document.createElement('div');
        companyColorItem.className = 'color-item';
        
        const companyLabel = document.createElement('label');
        companyLabel.textContent = '全社';
        
        const companyColorSpan = document.createElement('span');
        companyColorSpan.style.backgroundColor = this.companyDefaultColor;
        companyColorSpan.style.width = '20px';
        companyColorSpan.style.height = '20px';
        companyColorSpan.style.borderRadius = '3px';
        companyColorSpan.style.border = '1px solid #ccc';
        companyColorSpan.style.display = 'inline-block';
        companyColorSpan.style.marginLeft = '0.5rem';
        
        companyColorItem.appendChild(companyLabel);
        companyColorItem.appendChild(companyColorSpan);
        colorInfo.appendChild(companyColorItem);

        // 各部署の項目を追加（デフォルト値のみ表示）
        this.departments.forEach(department => {
            const colorItem = document.createElement('div');
            colorItem.className = 'color-item';
            
            const label = document.createElement('label');
            label.textContent = department.name;
            
            const colorSpan = document.createElement('span');
            colorSpan.style.backgroundColor = department.default_color;
            colorSpan.style.width = '20px';
            colorSpan.style.height = '20px';
            colorSpan.style.borderRadius = '3px';
            colorSpan.style.border = '1px solid #ccc';
            colorSpan.style.display = 'inline-block';
            colorSpan.style.marginLeft = '0.5rem';
            
            colorItem.appendChild(label);
            colorItem.appendChild(colorSpan);
            colorInfo.appendChild(colorItem);
        });
    }

    // 権限チェック
    canEditReservation(reservation) {
        if (!this.isLoggedIn) return false;
        if (this.isAdmin) return true;
        
        // 作成者または同じ部署
        return reservation.user_id === this.currentUser.id || 
               reservation.department_id === this.currentUser.department_id;
    }

    // 部署情報取得
    getDepartment(id) {
        return this.departments.find(dept => dept.id == id);
    }

    // 部署カラー取得
    getDepartmentColor(departmentId) {
        // ログインしていてユーザー設定がある場合
        if (this.isLoggedIn && this.userColorSettings[departmentId]) {
            return this.userColorSettings[departmentId];
        }
        
        // 部署のデフォルトカラーを取得
        const department = this.getDepartment(departmentId);
        if (department) {
            return department.default_color;
        }
        
        return '#718096';
    }

    // 予約カラー取得（全社かどうかも考慮）
    getReservationColor(reservation) {
        // console.log('予約カラー取得:', {
        //     reservation: reservation,
        //     user_department_id: reservation.user_department_id,
        //     department_id: reservation.department_id,
        //     is_company_wide: reservation.is_company_wide
        // });
        
        // 全社の場合
        if (reservation.is_company_wide) {
            if (this.isLoggedIn) {
                return this.userColorSettings['company'] || this.companyDefaultColor;
            } else {
                return this.companyDefaultColor; // ログインしていない場合の全社デフォルトカラー
            }
        }
        
        // 部署固有の場合 - department_idも試す
        const departmentId = reservation.user_department_id || reservation.department_id;
        return this.getDepartmentColor(departmentId);
    }

    // 配列形式のカラー設定をオブジェクト形式に変換
    convertArrayToObjectSettings(arraySettings) {
        const objectSettings = {};
        
        // 配列の各インデックスを部署IDまたは特別なキーにマッピング
        // インデックス0は全社（company）として扱う
        if (arraySettings[0] !== null && arraySettings[0] !== undefined) {
            objectSettings['company'] = arraySettings[0];
        }
        
        // インデックス1以降は部署ID（1, 2, 3...）として扱う
        for (let i = 1; i < arraySettings.length; i++) {
            if (arraySettings[i] !== null && arraySettings[i] !== undefined) {
                objectSettings[i.toString()] = arraySettings[i];
            }
        }
        
        
        return objectSettings;
    }

    // カラー設定をデフォルトに戻す
    async resetColorsToDefault() {
        try {
            // ユーザー設定をクリア
            this.userColorSettings = {};
            
            // 全社カラーをデフォルトカラーに設定
            this.userColorSettings['company'] = this.companyDefaultColor;
            
            // サーバーに設定を保存
            await put('api/users.php?action=colors', {
                color_settings: this.userColorSettings
            });
            
            // UI更新
            this.updateColorSettings();
            
            // カレンダー再描画
            if (window.calendarManager) {
                window.calendarManager.render();
            }
            
            showSuccessMessage('カラー設定をデフォルトに戻しました', document.querySelector('#sidebar-message'));
            
        } catch (error) {
            showErrorMessage('カラー設定のリセットに失敗しました', document.querySelector('#sidebar-message'));
        }
    }

    // 現在のユーザー情報取得
    getCurrentUser() {
        return this.currentUser;
    }

    // ログイン状態取得
    getLoginStatus() {
        return {
            isLoggedIn: this.isLoggedIn,
            isAdmin: this.isAdmin,
            user: this.currentUser
        };
    }
}

// グローバルインスタンス作成（シングルトンパターン）
let authManagerInstance = null;

function getAuthManager() {
    if (!authManagerInstance) {
        authManagerInstance = new AuthManager();
    }
    return authManagerInstance;
}

// エクスポート
export default getAuthManager();