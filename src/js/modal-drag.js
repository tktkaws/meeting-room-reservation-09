/**
 * モーダルドラッグ機能
 */
class ModalDrag {
    constructor() {
        this.dragData = {
            isDragging: false,
            startX: 0,
            startY: 0,
            startLeft: 0,
            startTop: 0,
            modal: null
        };
        this.init();
    }

    init() {
        this.bindEvents();
    }

    bindEvents() {
        // モーダルヘッダーのマウスダウンイベント
        document.addEventListener('mousedown', (e) => {
            const header = e.target.closest('.modal-header');
            if (header) {
                const modal = header.closest('.modal');
                if (modal) {
                    this.startDrag(e, modal);
                }
            }
        });

        // マウスムーブイベント
        document.addEventListener('mousemove', (e) => {
            if (this.dragData.isDragging) {
                this.onDrag(e);
            }
        });

        // マウスアップイベント
        document.addEventListener('mouseup', () => {
            this.stopDrag();
        });

        // モーダルが開かれた時のイベント
        document.addEventListener('click', (e) => {
            if (e.target.matches('[commandfor][command="show-modal"]')) {
                const modalId = e.target.getAttribute('commandfor');
                const modal = document.getElementById(modalId);
                if (modal) {
                    setTimeout(() => this.centerModal(modal), 0);
                }
            }
        });

        // dialog要素のcloseイベントを監視
        document.addEventListener('DOMContentLoaded', () => {
            const modals = document.querySelectorAll('dialog.modal');
            modals.forEach(modal => {
                modal.addEventListener('close', () => {
                    // console.log('Dialog close event triggered for:', modal.id);
                    this.resetModalPosition(modal);
                });
            });
        });

        // 動的に追加されたdialog要素にもイベントを追加
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE && node.matches('dialog.modal')) {
                        node.addEventListener('close', () => {
                            // console.log('Dialog close event triggered for:', node.id);
                            this.resetModalPosition(node);
                        });
                    }
                });
            });
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    startDrag(e, modal) {
        this.dragData.isDragging = true;
        this.dragData.modal = modal;
        this.dragData.startX = e.clientX;
        this.dragData.startY = e.clientY;

        const rect = modal.getBoundingClientRect();
        this.dragData.startLeft = rect.left;
        this.dragData.startTop = rect.top;

        // モーダルの位置を絶対配置に変更
        modal.style.position = 'fixed';
        modal.style.left = this.dragData.startLeft + 'px';
        modal.style.top = this.dragData.startTop + 'px';
        modal.style.margin = '0';
        modal.style.transform = 'none';

        e.preventDefault();
    }

    onDrag(e) {
        if (!this.dragData.isDragging || !this.dragData.modal) return;

        const deltaX = e.clientX - this.dragData.startX;
        const deltaY = e.clientY - this.dragData.startY;

        let newLeft = this.dragData.startLeft + deltaX;
        let newTop = this.dragData.startTop + deltaY;

        // 画面境界チェック
        const modalRect = this.dragData.modal.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // 左端制限
        if (newLeft < 0) {
            newLeft = 0;
        }

        // 右端制限
        if (newLeft + modalRect.width > viewportWidth) {
            newLeft = viewportWidth - modalRect.width;
        }

        // 上端制限
        if (newTop < 0) {
            newTop = 0;
        }

        // 下端制限
        if (newTop + modalRect.height > viewportHeight) {
            newTop = viewportHeight - modalRect.height;
        }

        this.dragData.modal.style.left = newLeft + 'px';
        this.dragData.modal.style.top = newTop + 'px';
    }

    stopDrag() {
        this.dragData.isDragging = false;
        this.dragData.modal = null;
    }

    centerModal(modal) {
        modal.style.position = 'fixed';
        modal.style.left = '50%';
        modal.style.top = '50%';
        modal.style.transform = 'translate(-50%, -50%)';
        modal.style.margin = '0';
    }

    resetModalPosition(modal) {
        // console.log('Resetting modal position for:', modal.id);
        
        // 強制的に位置をリセット
        modal.style.position = '';
        modal.style.left = '';
        modal.style.top = '';
        modal.style.transform = '';
        modal.style.margin = '';
        
        // 確実にリセットするために、少し遅延を入れてもう一度実行
        setTimeout(() => {
            modal.style.position = '';
            modal.style.left = '';
            modal.style.top = '';
            modal.style.transform = '';
            modal.style.margin = '';
            // console.log('Modal position reset completed for:', modal.id);
        }, 10);
    }
}

// グローバルなモーダルドラッグインスタンス
let modalDrag;

// DOMContentLoaded後に初期化
document.addEventListener('DOMContentLoaded', () => {
    modalDrag = new ModalDrag();
});

// 他のスクリプトからアクセスできるようにエクスポート
export { ModalDrag };