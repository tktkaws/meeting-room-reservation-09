// ユーザー新規登録ページのJavaScript

import { 
    get, 
    post, 
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

class SignupManager {
    constructor() {
        this.departments = [];
        this.init();
    }

    async init() {
        // 認証マネージャーの初期化を待つ
        await authManager.init();
        
        // 既にログインしている場合はindex.htmlに遷移
        if (authManager.getLoginStatus().isLoggedIn) {
            window.location.href = 'index.html';
            return;
        }

        await this.loadDepartments();
        this.setupEventListeners();
        this.populateForm();
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
        // 新規登録フォーム
        const signupForm = document.getElementById('signupForm');
        if (signupForm) {
            signupForm.addEventListener('submit', (e) => this.handleSignupSubmit(e));
        }

        // パスワード確認のリアルタイムバリデーション
        const password = document.getElementById('userPassword');
        const passwordConfirm = document.getElementById('userPasswordConfirm');
        
        if (password && passwordConfirm) {
            passwordConfirm.addEventListener('input', () => {
                if (passwordConfirm.value && password.value !== passwordConfirm.value) {
                    passwordConfirm.setCustomValidity('パスワードが一致しません');
                } else {
                    passwordConfirm.setCustomValidity('');
                }
            });
        }
    }

    // フォームにデータを設定
    populateForm() {
        // 部署選択肢を設定
        const userDepartmentSelect = document.getElementById('userDepartmentSelect');
        if (userDepartmentSelect) {
            clearElement(userDepartmentSelect);
            
            const defaultOption = createElement('option', '', '選択してください');
            defaultOption.value = '';
            userDepartmentSelect.appendChild(defaultOption);

            this.departments.forEach(dept => {
                const option = createElement('option', '', dept.name);
                option.value = dept.id;
                userDepartmentSelect.appendChild(option);
            });
        }
    }

    // 新規登録処理
    async handleSignupSubmit(event) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        const data = {
            name: formData.get('userName') || document.getElementById('userName').value,
            email: formData.get('userEmail') || document.getElementById('userEmail').value,
            password: formData.get('userPassword') || document.getElementById('userPassword').value,
            password_confirm: formData.get('userPasswordConfirm') || document.getElementById('userPasswordConfirm').value,
            department_id: formData.get('userDepartmentSelect') || document.getElementById('userDepartmentSelect').value,
            email_notification: document.getElementById('emailNotification').value === 'true'
        };

        // バリデーション
        const validation = this.validateSignupData(data);
        if (!validation.valid) {
            showErrorMessage(validation.message, event.target);
            return;
        }

        const submitBtn = event.target.querySelector('button[type="submit"]');
        const hideLoading = showLoading(submitBtn);

        try {
            // 新規登録API呼び出し
            const response = await post('api/auth.php?action=signup', data);
            
            showSuccessMessage('新規登録が完了しました。自動的にログインします...', event.target);
            
            // 新規登録成功後、自動ログイン
            setTimeout(async () => {
                try {
                    const loginResponse = await post('api/auth.php?action=login', {
                        email: data.email,
                        password: data.password
                    });

                    // 認証マネージャーの状態を更新
                    authManager.currentUser = loginResponse.user;
                    authManager.isLoggedIn = true;
                    authManager.isAdmin = Boolean(loginResponse.user.admin);
                    
                    if (authManager.currentUser.color_setting) {
                        const parsedSettings = JSON.parse(authManager.currentUser.color_setting);
                        if (Array.isArray(parsedSettings)) {
                            authManager.userColorSettings = authManager.convertArrayToObjectSettings(parsedSettings);
                        } else {
                            authManager.userColorSettings = parsedSettings;
                        }
                    }

                    showSuccessMessage('ログインしました。メイン画面に移動します...', event.target);
                    
                    // index.htmlに遷移
                    setTimeout(() => {
                        window.location.href = 'index.html';
                    }, 1000);
                    
                } catch (loginError) {
                    console.error('自動ログインに失敗しました:', loginError);
                    showErrorMessage('登録は完了しましたが、自動ログインに失敗しました。手動でログインしてください。', event.target);
                    
                    // index.htmlに遷移
                    setTimeout(() => {
                        window.location.href = 'index.html';
                    }, 2000);
                }
            }, 1000);
            
        } catch (error) {
            showErrorMessage(error.message, event.target);
        } finally {
            hideLoading();
        }
    }

    // 新規登録データバリデーション
    validateSignupData(data) {
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

        if (!validateRequired(data.password)) {
            return { valid: false, message: 'パスワードは必須です' };
        }

        if (!validateLength(data.password, 6, 100)) {
            return { valid: false, message: 'パスワードは6文字以上で入力してください' };
        }

        if (data.password !== data.password_confirm) {
            return { valid: false, message: 'パスワードと確認パスワードが一致しません' };
        }

        if (!validateRequired(data.department_id)) {
            return { valid: false, message: '部署を選択してください' };
        }

        return { valid: true };
    }
}

// DOM読み込み完了時の処理
document.addEventListener('DOMContentLoaded', () => {
    new SignupManager();
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

export default SignupManager;