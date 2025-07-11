// ユーザー設定ページのJavaScript

import { 
    get, 
    post, 
    put,
    validateRequired,
    validateEmail,
    validateLength,
    showErrorMessage,
    showSuccessMessage,
    showLoading,
    clearElement,
    createElement
} from './utils.js';
import authManager from './auth.js';

class ConfigManager {
    constructor() {
        this.currentUser = null;
        this.departments = [];
        this.init();
    }

    async init() {
        // 認証マネージャーの初期化を待つ
        await authManager.init();
        
        // ログイン状態チェック
        if (!authManager.getLoginStatus().isLoggedIn) {
            // index.htmlに遷移
            window.location.href = 'index.html';
            return;
        }

        await this.loadUserData();
        await this.loadDepartments();
        this.setupEventListeners();
        this.populateForm();
        this.updateColorSettings();
    }

    // ログイン必須メッセージ表示
    showLoginRequired() {
        const container = document.querySelector('.config-main') || document.querySelector('.main-content');
        if (container) {
            container.innerHTML = `
                <div style="text-align: center; padding: 2rem;">
                    <h2>ログインが必要です</h2>
                    <p>設定ページにアクセスするにはログインしてください。</p>
                    <p>左側のサイドバーからログインするか、メイン画面に戻ってください。</p>
                    <a href="index.html" style="display: inline-block; margin-top: 1rem; padding: 0.5rem 1rem; background-color: #3498db; color: white; text-decoration: none; border-radius: 4px;">
                        メイン画面に戻る
                    </a>
                </div>
            `;
        }
    }

    // ユーザーデータ読み込み
    async loadUserData() {
        try {
            const response = await get('api/auth.php?action=me');
            this.currentUser = response.user;
        } catch (error) {
            console.error('ユーザー情報の取得に失敗しました:', error);
            showErrorMessage('ユーザー情報の取得に失敗しました', document.body);
        }
    }

    // 部署一覧読み込み
    async loadDepartments() {
        try {
            const response = await get('api/departments.php');
            this.departments = response.departments;
        } catch (error) {
            console.error('部署情報の取得に失敗しました:', error);
            showErrorMessage('部署情報の取得に失敗しました', document.body);
        }
    }

    // イベントリスナー設定
    setupEventListeners() {
        // ユーザー情報フォーム
        const userInfoForm = document.getElementById('userInfoForm');
        if (userInfoForm) {
            userInfoForm.addEventListener('submit', (e) => this.handleUserInfoSubmit(e));
        }

        // パスワード変更フォーム
        const passwordForm = document.getElementById('passwordForm');
        if (passwordForm) {
            passwordForm.addEventListener('submit', (e) => this.handlePasswordSubmit(e));
        }

        // 通知設定フォーム
        const notificationForm = document.getElementById('notificationForm');
        if (notificationForm) {
            notificationForm.addEventListener('submit', (e) => this.handleNotificationSubmit(e));
        }

        // カラー設定保存
        const saveColorBtn = document.getElementById('saveColorSettings');
        if (saveColorBtn) {
            saveColorBtn.addEventListener('click', () => this.handleColorSave());
        }

        // ログアウトボタン（config.html用）
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.handleLogout());
        }

        // 認証状態変更の監視
        authManager.onAuthStateChanged = () => {
            if (!authManager.getLoginStatus().isLoggedIn) {
                // ログアウトされた場合、index.htmlに遷移
                window.location.href = 'index.html';
            }
        };
    }

    // ログアウト処理
    async handleLogout() {
        try {
            await authManager.handleLogout();
            // ログアウト成功後、index.htmlに遷移
            window.location.href = 'index.html';
        } catch (error) {
            console.error('ログアウトエラー:', error);
            // エラーが発生してもindex.htmlに遷移
            window.location.href = 'index.html';
        }
    }

    // フォームにデータを設定
    populateForm() {
        if (!this.currentUser) return;

        // ユーザー情報
        const userNameInput = document.getElementById('userNameInput');
        const userEmailInput = document.getElementById('userEmail');
        const userDepartmentSelect = document.getElementById('userDepartmentSelect');
        const emailNotificationSelect = document.getElementById('emailNotification');

        if (userNameInput) userNameInput.value = this.currentUser.name;
        if (userEmailInput) userEmailInput.value = this.currentUser.email;
        if (emailNotificationSelect) emailNotificationSelect.value = this.currentUser.email_notification ? 'true' : 'false';

        // 部署選択肢を設定
        if (userDepartmentSelect) {
            clearElement(userDepartmentSelect);
            
            const defaultOption = createElement('option', '', '選択してください');
            defaultOption.value = '';
            userDepartmentSelect.appendChild(defaultOption);

            this.departments.forEach(dept => {
                const option = createElement('option', '', dept.name);
                option.value = dept.id;
                if (dept.id == this.currentUser.department_id) {
                    option.selected = true;
                }
                userDepartmentSelect.appendChild(option);
            });
        }
    }

    // カラー設定UI更新
    updateColorSettings() {
        const departmentColors = document.getElementById('departmentColors');
        if (!departmentColors) return;

        clearElement(departmentColors);

        // 現在のカラー設定を取得
        let userColorSettings = {};
        if (this.currentUser && this.currentUser.color_setting) {
            try {
                userColorSettings = JSON.parse(this.currentUser.color_setting);
            } catch (error) {
                console.error('カラー設定の解析に失敗しました:', error);
            }
        }

        this.departments.forEach(dept => {
            const colorGroup = createElement('div', 'form-group');
            
            const label = createElement('label', '');
            label.textContent = `${dept.name}のカラー`;
            label.setAttribute('for', `color-${dept.id}`);
            
            const colorInput = createElement('input');
            colorInput.type = 'color';
            colorInput.id = `color-${dept.id}`;
            colorInput.value = userColorSettings[dept.id] || dept.default_color;
            colorInput.dataset.departmentId = dept.id;
            
            const resetBtn = createElement('button', '', 'リセット');
            resetBtn.type = 'button';
            resetBtn.style.marginLeft = '10px';
            resetBtn.addEventListener('click', () => {
                colorInput.value = dept.default_color;
            });
            
            colorGroup.appendChild(label);
            colorGroup.appendChild(colorInput);
            colorGroup.appendChild(resetBtn);
            departmentColors.appendChild(colorGroup);
        });
    }

    // ユーザー情報更新処理
    async handleUserInfoSubmit(event) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        const data = {
            name: formData.get('userNameInput') || document.getElementById('userNameInput').value,
            email: formData.get('userEmail') || document.getElementById('userEmail').value,
            department_id: formData.get('userDepartmentSelect') || document.getElementById('userDepartmentSelect').value,
            email_notification: document.getElementById('emailNotification').value === 'true'
        };

        // バリデーション
        const validation = this.validateUserInfo(data);
        if (!validation.valid) {
            showErrorMessage(validation.message, event.target);
            return;
        }

        const submitBtn = event.target.querySelector('button[type="submit"]');
        const hideLoading = showLoading(submitBtn);

        try {
            const response = await put('api/users.php?action=profile', data);
            this.currentUser = response.user;
            showSuccessMessage('ユーザー情報を更新しました', event.target);
            
            // 認証マネージャーのユーザー情報も更新
            authManager.currentUser = this.currentUser;
            
        } catch (error) {
            showErrorMessage(error.message, event.target);
        } finally {
            hideLoading();
        }
    }

    // パスワード変更処理
    async handlePasswordSubmit(event) {
        event.preventDefault();
        
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        // バリデーション
        const validation = this.validatePassword(currentPassword, newPassword, confirmPassword);
        if (!validation.valid) {
            showErrorMessage(validation.message, event.target);
            return;
        }

        const submitBtn = event.target.querySelector('button[type="submit"]');
        const hideLoading = showLoading(submitBtn);

        try {
            await put('api/users.php?action=password', {
                current_password: currentPassword,
                new_password: newPassword
            });
            
            showSuccessMessage('パスワードを変更しました', event.target);
            event.target.reset();
            
        } catch (error) {
            showErrorMessage(error.message, event.target);
        } finally {
            hideLoading();
        }
    }

    // 通知設定処理
    async handleNotificationSubmit(event) {
        event.preventDefault();
        
        const emailNotification = document.getElementById('emailNotification').value === 'true';
        
        const submitBtn = event.target.querySelector('button[type="submit"]');
        const hideLoading = showLoading(submitBtn);

        try {
            await put('api/users.php?action=profile', {
                name: this.currentUser.name,
                email: this.currentUser.email,
                department_id: this.currentUser.department_id,
                email_notification: emailNotification
            });
            
            this.currentUser.email_notification = emailNotification;
            showSuccessMessage('通知設定を保存しました', event.target);
            
        } catch (error) {
            showErrorMessage(error.message, event.target);
        } finally {
            hideLoading();
        }
    }

    // カラー設定保存処理
    async handleColorSave() {
        const colorInputs = document.querySelectorAll('#departmentColors input[type="color"]');
        const colorSettings = {};
        
        colorInputs.forEach(input => {
            const departmentId = input.dataset.departmentId;
            const color = input.value;
            const defaultColor = this.departments.find(d => d.id == departmentId)?.default_color;
            
            // デフォルトカラーと異なる場合のみ保存
            if (color !== defaultColor) {
                colorSettings[departmentId] = color;
            }
        });

        const saveBtn = document.getElementById('saveColorSettings');
        const hideLoading = showLoading(saveBtn);

        try {
            await put('api/users.php?action=colors', {
                color_settings: colorSettings
            });
            
            // 現在のユーザー情報を更新
            this.currentUser.color_setting = JSON.stringify(colorSettings);
            
            // 認証マネージャーも更新
            authManager.currentUser = this.currentUser;
            authManager.userColorSettings = colorSettings;
            
            showSuccessMessage('カラー設定を保存しました', document.querySelector('.color-section'));
            
        } catch (error) {
            showErrorMessage(error.message, document.querySelector('.color-section'));
        } finally {
            hideLoading();
        }
    }

    // ユーザー情報バリデーション
    validateUserInfo(data) {
        if (!validateRequired(data.name)) {
            return { valid: false, message: '名前は必須です' };
        }

        if (!validateLength(data.name, 1, 100)) {
            return { valid: false, message: '名前は100文字以下で入力してください' };
        }

        if (!validateRequired(data.email)) {
            return { valid: false, message: 'メールアドレスは必須です' };
        }

        if (!validateEmail(data.email)) {
            return { valid: false, message: '有効なメールアドレスを入力してください' };
        }

        if (!validateRequired(data.department_id)) {
            return { valid: false, message: '部署を選択してください' };
        }

        return { valid: true };
    }

    // パスワードバリデーション
    validatePassword(currentPassword, newPassword, confirmPassword) {
        if (!validateRequired(currentPassword)) {
            return { valid: false, message: '現在のパスワードは必須です' };
        }

        if (!validateRequired(newPassword)) {
            return { valid: false, message: '新しいパスワードは必須です' };
        }

        if (!validateLength(newPassword, 6, 100)) {
            return { valid: false, message: '新しいパスワードは6文字以上で入力してください' };
        }

        if (newPassword !== confirmPassword) {
            return { valid: false, message: '新しいパスワードと確認パスワードが一致しません' };
        }

        return { valid: true };
    }
}

// DOM読み込み完了時の処理
document.addEventListener('DOMContentLoaded', () => {
    new ConfigManager();
});

// エラーハンドリング
window.addEventListener('error', (event) => {
    console.error('JavaScript エラー:', event.error);
    showErrorMessage('予期しないエラーが発生しました', document.body);
});

// 未処理のPromise拒否をキャッチ
window.addEventListener('unhandledrejection', (event) => {
    console.error('未処理のPromise拒否:', event.reason);
    showErrorMessage('通信エラーが発生しました', document.body);
});

// ページを離れる前の確認（無効化）
// window.addEventListener('beforeunload', (event) => {
//     // フォームが変更されている場合は確認
//     const forms = document.querySelectorAll('form');
//     for (const form of forms) {
//         if (form.checkValidity && form.checkValidity() === false) {
//             event.preventDefault();
//             event.returnValue = '変更が保存されていません。本当にページを離れますか？';
//             break;
//         }
//     }
// });

// キーボードショートカット
document.addEventListener('keydown', (event) => {
    // Ctrl+S: 設定保存
    if (event.ctrlKey && event.key === 's') {
        event.preventDefault();
        const activeElement = document.activeElement;
        const form = activeElement.closest('form');
        if (form) {
            form.requestSubmit();
        }
    }
});

export default ConfigManager;