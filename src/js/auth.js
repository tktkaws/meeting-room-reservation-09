// 認証関連の機能

import { get, post, showErrorMessage, showSuccessMessage, showLoading } from './utils.js';

class AuthManager {
    constructor() {
        this.currentUser = null;
        this.isLoggedIn = false;
        this.isAdmin = false;
        this.departments = [];
        this.userColorSettings = {};
        this.init();
    }

    async init() {
        await this.checkAuthStatus();
        await this.loadDepartments();
        this.setupEventListeners();
    }

    // 認証状態確認
    async checkAuthStatus() {
        try {
            const response = await get('api/auth.php?action=status');
            this.isLoggedIn = response.loggedIn;
            this.isAdmin = response.admin;
            this.currentUser = response.user;
            
            if (this.currentUser && this.currentUser.color_setting) {
                this.userColorSettings = JSON.parse(this.currentUser.color_setting);
            }
            
            this.updateUI();
        } catch (error) {
            console.error('認証状態の確認に失敗しました:', error);
            this.isLoggedIn = false;
            this.isAdmin = false;
            this.currentUser = null;
            this.updateUI();
        }
    }

    // 部署一覧取得
    async loadDepartments() {
        try {
            const response = await get('api/departments.php');
            this.departments = response.departments;
            this.updateColorSettings();
        } catch (error) {
            console.error('部署情報の取得に失敗しました:', error);
        }
    }

    // イベントリスナー設定
    setupEventListeners() {
        // ログインフォーム
        const loginForm = document.querySelector('#loginForm form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        // ログアウトボタン
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.handleLogout());
        }

        // カラー設定
        const colorSettings = document.getElementById('colorSettings');
        if (colorSettings) {
            colorSettings.addEventListener('change', (e) => this.handleColorChange(e));
        }
    }

    // ログイン処理
    async handleLogin(event) {
        event.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        if (!email || !password) {
            showErrorMessage('メールアドレスとパスワードを入力してください。', document.querySelector('.login-section'));
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
            this.isAdmin = response.user.admin;
            
            if (this.currentUser.color_setting) {
                this.userColorSettings = JSON.parse(this.currentUser.color_setting);
            }

            showSuccessMessage('ログインしました', document.querySelector('.login-section'));
            
            // フォームをリセット
            event.target.reset();
            
            // UI更新
            this.updateUI();
            
            // メインコンテンツ更新
            if (window.reservationManager) {
                window.reservationManager.loadReservations();
            }

        } catch (error) {
            showErrorMessage(error.message, document.querySelector('.login-section'));
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
            
            showSuccessMessage('ログアウトしました', document.querySelector('.login-section'));
            
            // UI更新
            this.updateUI();
            
            // メインコンテンツ更新
            if (window.reservationManager) {
                window.reservationManager.loadReservations();
            }

        } catch (error) {
            showErrorMessage(error.message, document.querySelector('.login-section'));
        }
    }

    // カラー設定変更
    async handleColorChange(event) {
        if (event.target.type === 'color') {
            const departmentId = event.target.dataset.departmentId;
            const color = event.target.value;
            
            this.userColorSettings[departmentId] = color;
            
            try {
                await post('api/users.php?action=colors', {
                    color_settings: this.userColorSettings
                });
                
                // カレンダー再描画
                if (window.calendarManager) {
                    window.calendarManager.render();
                }
                
            } catch (error) {
                showErrorMessage('カラー設定の保存に失敗しました', document.querySelector('.color-settings'));
            }
        }
    }

    // UI更新
    updateUI() {
        const loginForm = document.getElementById('loginForm');
        const userInfo = document.getElementById('userInfo');
        const userName = document.getElementById('userName');
        const userDepartment = document.getElementById('userDepartment');
        const actionButtons = document.getElementById('actionButtons');

        if (this.isLoggedIn && this.currentUser) {
            // ログイン済み表示
            if (loginForm) loginForm.style.display = 'none';
            if (userInfo) userInfo.style.display = 'block';
            if (userName) userName.textContent = this.currentUser.name;
            if (userDepartment) userDepartment.textContent = this.currentUser.department_name;
            if (actionButtons) actionButtons.style.display = 'block';
        } else {
            // 未ログイン表示
            if (loginForm) loginForm.style.display = 'block';
            if (userInfo) userInfo.style.display = 'none';
            if (actionButtons) actionButtons.style.display = 'none';
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
        if (!colorSettings || !this.isLoggedIn) return;

        colorSettings.innerHTML = '';

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
        if (this.userColorSettings[departmentId]) {
            return this.userColorSettings[departmentId];
        }
        
        const department = this.getDepartment(departmentId);
        return department ? department.default_color : '#718096';
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

// グローバルインスタンス作成
const authManager = new AuthManager();

// エクスポート
export default authManager;