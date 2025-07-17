// ユーザー管理ページのJavaScript

import { 
    get, 
    post, 
    put,
    del,
    validateRequired,
    validateEmail,
    validateLength,
    showErrorMessage,
    showSuccessMessage,
    showLoading,
    clearElement,
    createElement,
    showModal,
    hideModal,
    formatDate,
    initializeHamburgerMenu
} from './utils.js';
import authManager from './auth.js';
import { ModalDrag } from './modal-drag.js';

class UserManagementManager {
    constructor() {
        this.users = [];
        this.departments = [];
        this.selectedUsers = new Set();
        this.currentEditingUser = null;
        this.sortField = 'created_at';
        this.sortDirection = 'desc';
        this.init();
    }

    async init() {
        // 認証マネージャーの初期化を待つ
        await authManager.init();
        
        // 管理者権限チェック
        const loginStatus = authManager.getLoginStatus();
        if (!loginStatus.isLoggedIn || !loginStatus.isAdmin) {
            // 管理者でない場合はindex.htmlに遷移
            window.location.href = 'index.html';
            return;
        }

        await this.loadUsers();
        await this.loadDepartments();
        this.setupEventListeners();
        this.populateUserTable();
        
        // ハンバーガーメニューの初期化
        initializeHamburgerMenu();
    }

    // ユーザー一覧読み込み
    async loadUsers() {
        try {
            const response = await get('api/users.php');
            this.users = response.users;
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
        // 全選択チェックボックス
        const selectAllCheckbox = document.getElementById('selectAllCheckbox');
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', (e) => this.handleSelectAll(e));
        }

        // 一括操作ボタン
        const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
        if (bulkDeleteBtn) {
            bulkDeleteBtn.addEventListener('click', () => this.showDeleteConfirmModal());
        }

        const bulkEditBtn = document.getElementById('bulkEditBtn');
        if (bulkEditBtn) {
            bulkEditBtn.addEventListener('click', () => this.showBulkEditModal());
        }

        const selectAllBtn = document.getElementById('selectAllBtn');
        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => this.selectAllUsers());
        }

        const deselectAllBtn = document.getElementById('deselectAllBtn');
        if (deselectAllBtn) {
            deselectAllBtn.addEventListener('click', () => this.deselectAllUsers());
        }

        // モーダル関連
        this.setupModalEventListeners();

        // 一括操作選択変更
        const bulkOperation = document.getElementById('bulkOperation');
        if (bulkOperation) {
            bulkOperation.addEventListener('change', (e) => this.handleBulkOperationChange(e));
        }

        // ソート機能
        const sortableHeaders = document.querySelectorAll('.sortable-header');
        sortableHeaders.forEach(header => {
            header.addEventListener('click', (e) => this.handleSort(e));
        });
    }

    // モーダルイベントリスナー設定
    setupModalEventListeners() {
        // 編集モーダル
        const userEditForm = document.getElementById('userEditForm');
        if (userEditForm) {
            userEditForm.addEventListener('submit', (e) => this.handleUserEditSubmit(e));
        }


        // 一括編集モーダル
        const bulkEditForm = document.getElementById('bulkEditForm');
        if (bulkEditForm) {
            bulkEditForm.addEventListener('submit', (e) => this.handleBulkEditSubmit(e));
        }


        // 削除確認モーダル
        const confirmDelete = document.getElementById('confirmDelete');
        if (confirmDelete) {
            confirmDelete.addEventListener('click', () => this.handleBulkDelete());
        }


    }

    // ユーザーテーブルを作成
    populateUserTable() {
        const tableBody = document.getElementById('userTableBody');
        if (!tableBody) return;

        clearElement(tableBody);

        // ソート済みのユーザーリストを取得
        const sortedUsers = this.getSortedUsers();

        sortedUsers.forEach(user => {
            const row = createElement('div', 'user-table-row');
            
            row.innerHTML = `
                <div class="table-cell checkbox-cell">
                    <input type="checkbox" data-user-id="${user.id}" class="user-checkbox">
                </div>
                <div class="table-cell">${user.name}</div>
                <div class="table-cell">${user.email}</div>
                <div class="table-cell">${user.department_name}</div>
                <div class="table-cell">${user.email_notification ? '受信する' : '受信しない'}</div>
                <div class="table-cell">${user.admin ? '管理者' : '一般ユーザー'}</div>
                <div class="table-cell">
                    <button class="btn btn-sm btn-outline edit-user-btn" data-user-id="${user.id}">編集</button>
                </div>
            `;

            // チェックボックスイベント
            const checkbox = row.querySelector('.user-checkbox');
            checkbox.addEventListener('change', (e) => this.handleUserSelect(e));

            // 編集ボタンイベント
            const editBtn = row.querySelector('.edit-user-btn');
            editBtn.addEventListener('click', () => this.showUserEditModal(user));

            tableBody.appendChild(row);
        });

        // ソート表示を更新
        this.updateSortIndicators();
    }

    // ソート処理
    handleSort(event) {
        const sortField = event.currentTarget.dataset.sort;
        
        if (this.sortField === sortField) {
            // 同じフィールドの場合は昇順/降順を切り替え
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            // 異なるフィールドの場合は新しいフィールドで昇順
            this.sortField = sortField;
            this.sortDirection = 'asc';
        }

        this.populateUserTable();
    }

    // ソート済みユーザーリストを取得
    getSortedUsers() {
        return [...this.users].sort((a, b) => {
            let aValue = a[this.sortField];
            let bValue = b[this.sortField];

            // 値の前処理
            if (this.sortField === 'email_notification' || this.sortField === 'admin') {
                // booleanの場合
                aValue = aValue ? 1 : 0;
                bValue = bValue ? 1 : 0;
            } else if (this.sortField === 'created_at') {
                // 日付の場合
                aValue = new Date(aValue);
                bValue = new Date(bValue);
            } else if (typeof aValue === 'string') {
                // 文字列の場合は大文字小文字を区別しない
                aValue = aValue.toLowerCase();
                bValue = bValue.toLowerCase();
            }

            let comparison = 0;
            if (aValue < bValue) {
                comparison = -1;
            } else if (aValue > bValue) {
                comparison = 1;
            }

            return this.sortDirection === 'desc' ? -comparison : comparison;
        });
    }

    // ソート表示を更新
    updateSortIndicators() {
        // 全てのソート表示をクリア
        const sortIndicators = document.querySelectorAll('.sort-indicator');
        sortIndicators.forEach(indicator => {
            indicator.textContent = '';
        });

        // 現在のソートフィールドに表示を追加
        const currentHeader = document.querySelector(`[data-sort="${this.sortField}"]`);
        if (currentHeader) {
            const indicator = currentHeader.querySelector('.sort-indicator');
            if (indicator) {
                indicator.textContent = this.sortDirection === 'asc' ? ' ▲' : ' ▼';
            }
        }
    }

    // ユーザー選択処理
    handleUserSelect(event) {
        const userId = parseInt(event.target.dataset.userId);
        
        if (event.target.checked) {
            this.selectedUsers.add(userId);
        } else {
            this.selectedUsers.delete(userId);
        }

        this.updateBulkActionButtons();
        this.updateSelectAllCheckbox();
    }

    // 全選択処理
    handleSelectAll(event) {
        const checkboxes = document.querySelectorAll('.user-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = event.target.checked;
            const userId = parseInt(checkbox.dataset.userId);
            
            if (event.target.checked) {
                this.selectedUsers.add(userId);
            } else {
                this.selectedUsers.delete(userId);
            }
        });

        this.updateBulkActionButtons();
    }

    // 全選択ボタン
    selectAllUsers() {
        const selectAllCheckbox = document.getElementById('selectAllCheckbox');
        if (selectAllCheckbox) {
            selectAllCheckbox.checked = true;
            this.handleSelectAll({ target: selectAllCheckbox });
        }
    }

    // 全解除ボタン
    deselectAllUsers() {
        const selectAllCheckbox = document.getElementById('selectAllCheckbox');
        if (selectAllCheckbox) {
            selectAllCheckbox.checked = false;
            this.handleSelectAll({ target: selectAllCheckbox });
        }
    }

    // 一括操作ボタンの状態更新
    updateBulkActionButtons() {
        const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
        const bulkEditBtn = document.getElementById('bulkEditBtn');
        const hasSelection = this.selectedUsers.size > 0;

        if (bulkDeleteBtn) bulkDeleteBtn.disabled = !hasSelection;
        if (bulkEditBtn) bulkEditBtn.disabled = !hasSelection;
    }

    // 全選択チェックボックスの状態更新
    updateSelectAllCheckbox() {
        const selectAllCheckbox = document.getElementById('selectAllCheckbox');
        if (!selectAllCheckbox) return;

        const totalUsers = this.users.length;
        const selectedCount = this.selectedUsers.size;

        if (selectedCount === 0) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
        } else if (selectedCount === totalUsers) {
            selectAllCheckbox.checked = true;
            selectAllCheckbox.indeterminate = false;
        } else {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = true;
        }
    }

    // ユーザー編集モーダル表示
    showUserEditModal(user) {
        this.currentEditingUser = user;
        
        // フォームに値を設定
        document.getElementById('editUserName').value = user.name;
        document.getElementById('editUserEmail').value = user.email;
        document.getElementById('editUserEmailNotification').value = user.email_notification.toString();
        document.getElementById('editUserAdmin').value = user.admin.toString();

        // 部署選択肢を設定
        const departmentSelect = document.getElementById('editUserDepartment');
        clearElement(departmentSelect);
        
        const defaultOption = createElement('option', '', '選択してください');
        defaultOption.value = '';
        departmentSelect.appendChild(defaultOption);

        this.departments.forEach(dept => {
            const option = createElement('option', '', dept.name);
            option.value = dept.id;
            if (dept.id == user.department_id) {
                option.selected = true;
            }
            departmentSelect.appendChild(option);
        });

        showModal('userEditModal');
    }

    // 一括編集モーダル表示
    showBulkEditModal() {
        // 部署選択肢を設定
        const departmentSelect = document.getElementById('bulkDepartment');
        clearElement(departmentSelect);
        
        const defaultOption = createElement('option', '', '選択してください');
        defaultOption.value = '';
        departmentSelect.appendChild(defaultOption);

        this.departments.forEach(dept => {
            const option = createElement('option', '', dept.name);
            option.value = dept.id;
            departmentSelect.appendChild(option);
        });

        showModal('bulkEditModal');
    }

    // 削除確認モーダル表示
    showDeleteConfirmModal() {
        showModal('deleteConfirmModal');
    }

    // 一括操作選択変更処理
    handleBulkOperationChange(event) {
        const operation = event.target.value;
        
        // 全てのグループを非表示
        document.getElementById('bulkDepartmentGroup').style.display = 'none';
        document.getElementById('bulkEmailNotificationGroup').style.display = 'none';
        document.getElementById('bulkAdminGroup').style.display = 'none';

        // 選択された操作に応じて表示
        if (operation === 'department') {
            document.getElementById('bulkDepartmentGroup').style.display = 'block';
        } else if (operation === 'email_notification') {
            document.getElementById('bulkEmailNotificationGroup').style.display = 'block';
        } else if (operation === 'admin') {
            document.getElementById('bulkAdminGroup').style.display = 'block';
        }
    }

    // ユーザー編集処理
    async handleUserEditSubmit(event) {
        event.preventDefault();
        
        if (!this.currentEditingUser) return;

        const data = {
            name: document.getElementById('editUserName').value,
            email: document.getElementById('editUserEmail').value,
            department_id: document.getElementById('editUserDepartment').value,
            email_notification: document.getElementById('editUserEmailNotification').value === 'true',
            admin: document.getElementById('editUserAdmin').value === 'true'
        };

        const submitBtn = event.target.querySelector('button[type="submit"]');
        const hideLoading = showLoading(submitBtn);

        try {
            await put(`api/users.php?id=${this.currentEditingUser.id}`, data);
            showSuccessMessage('ユーザー情報を更新しました', document.body);
            
            hideModal('userEditModal');
            await this.loadUsers();
            this.populateUserTable();
            
        } catch (error) {
            showErrorMessage(error.message, document.body);
        } finally {
            hideLoading();
        }
    }

    // 一括編集処理
    async handleBulkEditSubmit(event) {
        event.preventDefault();
        
        const operation = document.getElementById('bulkOperation').value;
        const selectedUserIds = Array.from(this.selectedUsers);
        
        if (selectedUserIds.length === 0) {
            showErrorMessage('ユーザーを選択してください', document.body);
            return;
        }

        let data = {
            user_ids: selectedUserIds,
            operation: operation
        };

        // 操作に応じて値を設定
        if (operation === 'department') {
            data.department_id = document.getElementById('bulkDepartment').value;
        } else if (operation === 'email_notification') {
            data.email_notification = document.getElementById('bulkEmailNotification').value === 'true';
        } else if (operation === 'admin') {
            data.admin = document.getElementById('bulkAdmin').value === 'true';
        }

        const submitBtn = event.target.querySelector('button[type="submit"]');
        const hideLoading = showLoading(submitBtn);

        try {
            await post('api/users.php?action=bulk_edit', data);
            showSuccessMessage('一括編集が完了しました', document.body);
            
            hideModal('bulkEditModal');
            await this.loadUsers();
            this.populateUserTable();
            this.selectedUsers.clear();
            this.updateBulkActionButtons();
            
        } catch (error) {
            showErrorMessage(error.message, document.body);
        } finally {
            hideLoading();
        }
    }

    // 一括削除処理
    async handleBulkDelete() {
        const selectedUserIds = Array.from(this.selectedUsers);
        
        if (selectedUserIds.length === 0) {
            showErrorMessage('ユーザーを選択してください', document.body);
            return;
        }

        const confirmBtn = document.getElementById('confirmDelete');
        const hideLoading = showLoading(confirmBtn);

        try {
            await post('api/users.php?action=bulk_delete', {
                user_ids: selectedUserIds
            });
            
            showSuccessMessage('選択したユーザーを削除しました', document.body);
            
            hideModal('deleteConfirmModal');
            await this.loadUsers();
            this.populateUserTable();
            this.selectedUsers.clear();
            this.updateBulkActionButtons();
            
        } catch (error) {
            showErrorMessage(error.message, document.body);
        } finally {
            hideLoading();
        }
    }
}

// DOM読み込み完了時の処理
document.addEventListener('DOMContentLoaded', () => {
    new UserManagementManager();
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

export default UserManagementManager;