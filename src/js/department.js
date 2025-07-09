// 部署管理ページのJavaScript

import { 
    get, 
    post, 
    put, 
    del,
    validateRequired,
    validateLength,
    showErrorMessage,
    showSuccessMessage,
    showLoading,
    showModal,
    hideModal,
    confirm,
    clearElement,
    createElement
} from './utils.js';
import authManager from './auth.js';

class DepartmentManager {
    constructor() {
        this.departments = [];
        this.currentEditingDepartment = null;
        this.init();
    }

    async init() {
        // 管理者権限チェック
        if (!authManager.getLoginStatus().isAdmin) {
            window.location.href = 'index.html';
            return;
        }

        await this.loadDepartments();
        this.setupEventListeners();
        this.renderDepartmentTable();
    }

    // 部署一覧読み込み
    async loadDepartments() {
        try {
            const response = await get('/api/departments.php');
            this.departments = response.departments;
        } catch (error) {
            console.error('部署情報の取得に失敗しました:', error);
            showErrorMessage('部署情報の取得に失敗しました', document.body);
        }
    }

    // イベントリスナー設定
    setupEventListeners() {
        // 部署フォーム
        const departmentForm = document.getElementById('departmentForm');
        if (departmentForm) {
            departmentForm.addEventListener('submit', (e) => this.handleFormSubmit(e));
        }

        // キャンセルボタン
        const cancelBtn = document.getElementById('cancelBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.resetForm());
        }

        // 削除確認モーダル
        const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
        if (confirmDeleteBtn) {
            confirmDeleteBtn.addEventListener('click', () => this.confirmDelete());
        }

        const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
        if (cancelDeleteBtn) {
            cancelDeleteBtn.addEventListener('click', () => hideModal('deleteModal'));
        }
    }

    // 部署テーブル描画
    renderDepartmentTable() {
        const tbody = document.getElementById('departmentTableBody');
        if (!tbody) return;

        clearElement(tbody);

        this.departments.forEach(dept => {
            const row = this.createDepartmentRow(dept);
            tbody.appendChild(row);
        });
    }

    // 部署行作成
    createDepartmentRow(department) {
        const row = createElement('tr');
        
        // 部署名
        const nameCell = createElement('td', '', department.name);
        row.appendChild(nameCell);
        
        // デフォルトカラー
        const colorCell = createElement('td');
        const colorDisplay = createElement('span', 'color-display');
        colorDisplay.style.backgroundColor = department.default_color;
        const colorText = createElement('span', '', department.default_color);
        colorCell.appendChild(colorDisplay);
        colorCell.appendChild(colorText);
        row.appendChild(colorCell);
        
        // 表示順序
        const orderCell = createElement('td', '', department.display_order);
        row.appendChild(orderCell);
        
        // 作成日
        const createdCell = createElement('td', '', new Date(department.created_at).toLocaleDateString('ja-JP'));
        row.appendChild(createdCell);
        
        // 操作
        const actionCell = createElement('td');
        const actionButtons = createElement('div', 'action-buttons-table');
        
        const editBtn = createElement('button', 'edit-btn', '編集');
        editBtn.addEventListener('click', () => this.editDepartment(department));
        
        const deleteBtn = createElement('button', 'delete-btn', '削除');
        deleteBtn.addEventListener('click', () => this.showDeleteConfirmation(department));
        
        actionButtons.appendChild(editBtn);
        actionButtons.appendChild(deleteBtn);
        actionCell.appendChild(actionButtons);
        row.appendChild(actionCell);
        
        return row;
    }

    // フォーム送信処理
    async handleFormSubmit(event) {
        event.preventDefault();
        
        const formData = this.getFormData(event.target);
        
        // バリデーション
        const validation = this.validateFormData(formData);
        if (!validation.valid) {
            showErrorMessage(validation.message, event.target);
            return;
        }

        const submitBtn = event.target.querySelector('button[type="submit"]');
        const hideLoading = showLoading(submitBtn);

        try {
            if (this.currentEditingDepartment) {
                await this.updateDepartment(this.currentEditingDepartment.id, formData);
            } else {
                await this.createDepartment(formData);
            }
            
            await this.loadDepartments();
            this.renderDepartmentTable();
            this.resetForm();
            
        } catch (error) {
            showErrorMessage(error.message, event.target);
        } finally {
            hideLoading();
        }
    }

    // フォームデータ取得
    getFormData(form) {
        return {
            name: form.querySelector('#departmentName').value.trim(),
            default_color: form.querySelector('#defaultColor').value,
            display_order: parseInt(form.querySelector('#displayOrder').value) || 0
        };
    }

    // フォームデータバリデーション
    validateFormData(data) {
        if (!validateRequired(data.name)) {
            return { valid: false, message: '部署名は必須です' };
        }

        if (!validateLength(data.name, 1, 100)) {
            return { valid: false, message: '部署名は100文字以下で入力してください' };
        }

        // 重複チェック（編集時は自分以外）
        const existingDept = this.departments.find(dept => 
            dept.name === data.name && 
            (!this.currentEditingDepartment || dept.id !== this.currentEditingDepartment.id)
        );
        
        if (existingDept) {
            return { valid: false, message: 'この部署名は既に使用されています' };
        }

        return { valid: true };
    }

    // 部署作成
    async createDepartment(data) {
        const response = await post('/api/departments.php', data);
        showSuccessMessage('部署を作成しました', document.querySelector('.department-form-section'));
        return response;
    }

    // 部署更新
    async updateDepartment(id, data) {
        const response = await put('/api/departments.php', { id, ...data });
        showSuccessMessage('部署を更新しました', document.querySelector('.department-form-section'));
        return response;
    }

    // 部署削除
    async deleteDepartment(id) {
        const response = await del('/api/departments.php', { id });
        showSuccessMessage('部署を削除しました', document.querySelector('.department-list-section'));
        return response;
    }

    // 編集モード
    editDepartment(department) {
        this.currentEditingDepartment = department;
        
        // フォームタイトル変更
        const formTitle = document.getElementById('formTitle');
        if (formTitle) {
            formTitle.textContent = '部署編集';
        }
        
        // フォームにデータを設定
        const nameInput = document.getElementById('departmentName');
        const colorInput = document.getElementById('defaultColor');
        const orderInput = document.getElementById('displayOrder');
        const submitBtn = document.getElementById('submitBtn');
        const cancelBtn = document.getElementById('cancelBtn');
        
        if (nameInput) nameInput.value = department.name;
        if (colorInput) colorInput.value = department.default_color;
        if (orderInput) orderInput.value = department.display_order;
        if (submitBtn) submitBtn.textContent = '更新';
        if (cancelBtn) cancelBtn.style.display = 'inline-block';
        
        // フォームまでスクロール
        document.getElementById('departmentForm').scrollIntoView({ behavior: 'smooth' });
    }

    // フォームリセット
    resetForm() {
        this.currentEditingDepartment = null;
        
        const form = document.getElementById('departmentForm');
        if (form) form.reset();
        
        const formTitle = document.getElementById('formTitle');
        if (formTitle) formTitle.textContent = '新規部署追加';
        
        const submitBtn = document.getElementById('submitBtn');
        if (submitBtn) submitBtn.textContent = '追加';
        
        const cancelBtn = document.getElementById('cancelBtn');
        if (cancelBtn) cancelBtn.style.display = 'none';
        
        // デフォルトカラーを設定
        const colorInput = document.getElementById('defaultColor');
        if (colorInput) colorInput.value = '#718096';
        
        // 表示順序をリセット
        const orderInput = document.getElementById('displayOrder');
        if (orderInput) orderInput.value = '0';
    }

    // 削除確認表示
    showDeleteConfirmation(department) {
        this.departmentToDelete = department;
        showModal('deleteModal');
    }

    // 削除確認処理
    async confirmDelete() {
        if (!this.departmentToDelete) return;
        
        const confirmBtn = document.getElementById('confirmDeleteBtn');
        const hideLoading = showLoading(confirmBtn);
        
        try {
            await this.deleteDepartment(this.departmentToDelete.id);
            await this.loadDepartments();
            this.renderDepartmentTable();
            hideModal('deleteModal');
            this.departmentToDelete = null;
            
        } catch (error) {
            showErrorMessage(error.message, document.querySelector('#deleteModal .modal-content'));
        } finally {
            hideLoading();
        }
    }

    // 部署データ取得
    getDepartments() {
        return this.departments;
    }

    // 特定の部署取得
    getDepartment(id) {
        return this.departments.find(dept => dept.id === id);
    }
}

// DOM読み込み完了時の処理
document.addEventListener('DOMContentLoaded', () => {
    new DepartmentManager();
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

// ページを離れる前の確認
window.addEventListener('beforeunload', (event) => {
    // フォームが編集中の場合は確認
    const form = document.getElementById('departmentForm');
    if (form && document.getElementById('cancelBtn').style.display !== 'none') {
        event.preventDefault();
        event.returnValue = '編集中の内容が失われます。本当にページを離れますか？';
    }
});

// キーボードショートカット
document.addEventListener('keydown', (event) => {
    // Ctrl+N: 新規追加
    if (event.ctrlKey && event.key === 'n') {
        event.preventDefault();
        document.getElementById('departmentName').focus();
    }
    
    // Esc: 編集キャンセル
    if (event.key === 'Escape') {
        if (document.getElementById('cancelBtn').style.display !== 'none') {
            const departmentManager = window.departmentManager;
            if (departmentManager) {
                departmentManager.resetForm();
            }
        }
        
        // モーダルを閉じる
        const modal = document.getElementById('deleteModal');
        if (modal && modal.style.display === 'block') {
            hideModal('deleteModal');
        }
    }
});

// グローバルインスタンス
window.departmentManager = new DepartmentManager();

export default DepartmentManager;