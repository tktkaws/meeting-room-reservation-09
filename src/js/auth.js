// 認証関連の機能

import {
  get,
  post,
  put,
  showErrorMessage,
  showSuccessMessage,
  showLoading,
} from "./utils.js";

class AuthManager {
  constructor() {
    this.currentUser = null;
    this.isLoggedIn = false;
    this.isAdmin = false;
    this.departments = [];
    this.userColorSettings = {};
    this.companyDefaultColor = "#3498db";
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
      const response = await get("api/auth.php?action=status");
      this.isLoggedIn = response.loggedIn;
      this.isAdmin = Boolean(response.admin); // 明示的にbooleanに変換
      this.currentUser = response.user;

      if (this.currentUser && this.currentUser.color_setting) {
        const parsedSettings = JSON.parse(this.currentUser.color_setting);

        // 配列形式の場合はオブジェクト形式に変換
        if (Array.isArray(parsedSettings)) {
          this.userColorSettings =
            this.convertArrayToObjectSettings(parsedSettings);
        } else {
          this.userColorSettings = parsedSettings;
        }
      } else {
        this.userColorSettings = {};
      }

      this.updateUI();
    } catch (error) {
      console.error("認証状態の確認に失敗しました:", error);
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
      const response = await get("api/departments.php");
      this.departments = response.departments;

      // ログイン状態に応じてUIを更新
      if (this.isLoggedIn) {
        this.updateColorSettings();
      } else {
        this.updateColorInfo();
      }
    } catch (error) {
      console.error("部署情報の取得に失敗しました:", error);
    }
  }

  // 全社のデフォルトカラー取得
  async loadCompanyColor() {
    try {
      // console.log('全社カラー設定を取得します');
      const response = await get("api/company-color.php");
      // console.log('全社カラー設定の取得結果:', response);
      this.companyDefaultColor = response.color || "#3498db";

      // ログイン状態に応じてUIを更新
      if (this.isLoggedIn) {
        this.updateColorSettings();
      } else {
        this.updateColorInfo();
      }
    } catch (error) {
      console.error("全社カラー設定の取得に失敗しました:", error);
    }
  }

  // イベントリスナー設定
  setupEventListeners() {
    // console.log('AuthManager: イベントリスナーを設定します');

    // 既存のイベントリスナーをクリア
    this.clearEventListeners();

    // ログインフォーム
    const loginForm = document.querySelector("#loginForm form");
    if (loginForm) {
      this.loginHandler = (e) => this.handleLogin(e);
      loginForm.addEventListener("submit", this.loginHandler);
    }

    // ログアウトボタン
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      this.logoutHandler = () => this.handleLogout();
      logoutBtn.addEventListener("click", this.logoutHandler);
    }

    // カラー設定
    const colorSettings = document.getElementById("colorSettings");
    if (colorSettings) {
      this.colorChangeHandler = (e) => this.handleColorChange(e);
      colorSettings.addEventListener("change", this.colorChangeHandler);
    }
  }

  // イベントリスナーをクリア
  clearEventListeners() {
    // ログインフォーム
    const loginForm = document.querySelector("#loginForm form");
    if (loginForm && this.loginHandler) {
      loginForm.removeEventListener("submit", this.loginHandler);
    }

    // ログアウトボタン
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn && this.logoutHandler) {
      logoutBtn.removeEventListener("click", this.logoutHandler);
    }

    // カラー設定
    const colorSettings = document.getElementById("colorSettings");
    if (colorSettings && this.colorChangeHandler) {
      colorSettings.removeEventListener("change", this.colorChangeHandler);
    }
  }

  // ログイン処理
  async handleLogin(event) {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    if (!email || !password) {
      showErrorMessage(
        "メールアドレスとパスワードを入力してください。",
        document.querySelector("#sidebar-message")
      );
      return;
    }

    const submitBtn = event.target.querySelector('button[type="submit"]');
    const hideLoading = showLoading(submitBtn);

    try {
      const response = await post("api/auth.php?action=login", {
        email: email,
        password: password,
      });

      this.currentUser = response.user;
      this.isLoggedIn = true;
      this.isAdmin = Boolean(response.user.admin);

      if (this.currentUser.color_setting) {
        const parsedSettings = JSON.parse(this.currentUser.color_setting);
        // 配列形式の場合はオブジェクト形式に変換
        if (Array.isArray(parsedSettings)) {
          this.userColorSettings =
            this.convertArrayToObjectSettings(parsedSettings);
        } else {
          this.userColorSettings = parsedSettings;
        }
      }

      showSuccessMessage(
        "ログインしました",
        document.querySelector("#sidebar-message")
      );

      // フォームをリセット
      event.target.reset();

      // UI更新
      this.updateUI();

      // メインコンテンツ更新
      if (window.reservationManager) {
        window.reservationManager.loadReservations();
      }
    } catch (error) {
      showErrorMessage(
        error.message,
        document.querySelector("#sidebar-message")
      );
    } finally {
      hideLoading();
    }
  }

  // ログアウト処理
  async handleLogout() {
    try {
      await post("api/auth.php?action=logout");

      this.currentUser = null;
      this.isLoggedIn = false;
      this.isAdmin = false;
      this.userColorSettings = {};

      showSuccessMessage(
        "ログアウトしました",
        document.querySelector("#sidebar-message")
      );

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
      showErrorMessage(
        error.message,
        document.querySelector("#sidebar-message")
      );
    }
  }

  // カラー設定変更
  async handleColorChange(event) {
    if (event.target.type === "color") {
      const departmentId = event.target.dataset.departmentId;
      const color = event.target.value;

      this.userColorSettings[departmentId] = color;

      try {
        await put("api/users.php?action=colors", {
          color_settings: this.userColorSettings,
        });

        // カレンダー再描画
        if (window.calendarManager) {
          window.calendarManager.render();
        }
      } catch (error) {
        showErrorMessage(
          "カラー設定の保存に失敗しました",
          document.querySelector("#sidebar-message")
        );
      }
    }
  }

  // UI更新
  updateUI() {
    console.log("Rendering sidebar...");
    console.log("isLoggedIn:", this.isLoggedIn);
    console.log("isAdmin:", this.isAdmin);

    const sidebarHTML = `
            <h1><a href="/meeting-room-reservation-09/">会議室予約システム</a></h1>
            
            ${
              this.isLoggedIn
                ? `
                <div class="sidebar-section login-section">
                    <div id="userInfo" class="user-info">
                        <a href="config.html" class="user-info-item">
                            <img src="/meeting-room-reservation-09/src/images/person.svg" alt="" class="material-icon">
                            <p id="userName">${this.currentUser.name}</p>
                        </a>
                        <a href="config.html" class="user-info-item">
                            <img src="/meeting-room-reservation-09/src/images/groups.svg" alt="" class="material-icon">
                            <p id="userDepartment">${
                              this.currentUser.department_name
                            }</p>
                        </a>
                    </div>
                </div>
                
                <div class="sidebar-section color-settings">
                    <div id="colorSettings"></div>
                </div>
                
                <nav class="sidebar-section nav-section">
                    <a href="config.html" class="sidebar-btn-link">
                        <img src="/meeting-room-reservation-09/src/images/settings.svg" alt="" class="material-icon">設定
                    </a>
                    ${
                      this.isAdmin
                        ? `
                        <a id="adminMenu" href="department.html" class="sidebar-btn-link">
                            <img src="/meeting-room-reservation-09/src/images/manage.svg" alt="" class="material-icon">部署管理
                        </a>
                        <a id="adminMenu" href="user-management.html" class="sidebar-btn-link">
                            <img src="/meeting-room-reservation-09/src/images/manage.svg" alt="" class="material-icon">ユーザー管理
                        </a>
                        
                    `
                        : ""
                    }
                    <button id="logoutBtn" class="sidebar-btn">
                        <img src="/meeting-room-reservation-09/src/images/logout.svg" alt="" class="material-icon">
                        <span class="sidebar-btn-text">ログアウト</span>
                    </button>
                </nav>
            `
                : `
                <div class="sidebar-section login-section">
                    <div id="loginForm">
                        <form>
                            <input type="email" id="email" placeholder="メールアドレス" required>
                            <input type="password" id="password" placeholder="パスワード" required>
                            <button type="submit" class="btn btn-primary">ログイン</button>
                        </form>
                    </div>
                    
                </div>
                
                <div class="sidebar-section color-settings">
                    <div id="colorInfo"></div>
                </div>
                <div class="sidebar-section login-section">
                    <div id="loginForm">
                        
                        <p>
                            admin@example.com
                            <br>
                            takahashi@example.com
                        </p>
                    </div>
                    <a id="adminMenu" href="signup.html" class="sidebar-btn-link">
                           ※ 新規登録はこちら
                        </a>
                </div>
            `
            }
            
            <div id="sidebar-message"></div>
        `;

    const sidebarElement = document.querySelector("#sidebar");
    if (sidebarElement) {
      sidebarElement.innerHTML = sidebarHTML;
    }

    // UI更新後の処理
    if (this.isLoggedIn && this.currentUser) {
      // カラー設定更新
      this.updateColorSettings();

      // アクションボタン表示
      const actionButtons = document.getElementById("actionButtons");
      if (actionButtons) actionButtons.style.display = "grid";
    } else {
      // カラー情報更新
      this.updateColorInfo();

      // アクションボタン非表示
      const actionButtons = document.getElementById("actionButtons");
      if (actionButtons) actionButtons.style.display = "none";
    }

    // イベントリスナー再設定
    this.setupEventListeners();
  }

  // 管理者メニュー更新
  updateAdminMenu() {
    // 管理者メニューの表示/非表示
    const adminMenu = document.getElementById("adminMenu");
    if (adminMenu) {
      adminMenu.style.display = this.isAdmin ? "flex" : "none";
    }
  }

  // カラー設定UI更新
  updateColorSettings() {
    const colorSettings = document.getElementById("colorSettings");
    if (!colorSettings) return;

    // 全社カラー設定
    const companyColor =
      this.userColorSettings["company"] || this.companyDefaultColor;
    const companyColorHtml = `
            <form class="color-item" data-department-id="company">
                <input type="color" 
                       value="${companyColor}" 
                       data-department-id="company">
                <input type="text" 
                       value="${companyColor}" 
                       data-department-id="company"
                       placeholder="#FFFFFF" 
                       class="color-setting-text"
                       style="display: none;">
                <label class="color-label">JAMA</label>
                
            </form>
        `;

    // 部署カラー設定
    const departmentColorsHtml = this.departments
      .map((department) => {
        const departmentColor =
          this.userColorSettings[department.id] || department.default_color;
        return `
                <form class="color-item" data-department-id="${department.id}">
                    <input type="color" 
                           value="${departmentColor}" 
                           data-department-id="${department.id}">
                    <input type="text" 
                           value="${departmentColor}" 
                           data-department-id="${department.id}"
                           placeholder="#FFFFFF" 
                           class="color-setting-text"
                           style="display: none;">
                    <label class="color-label">${department.name}</label>
                    
                </form>
            `;
      })
      .join("");

    // デフォルトに戻すボタン
    const resetButtonHtml = `
            <div>
                <button id="resetBtn" class="sidebar-btn">
                    <img src="/meeting-room-reservation-09/src/images/refresh.svg" alt="" class="material-icon">
                    <span class="sidebar-btn-text">デフォルトに戻す</span>
                </button>
            </div>
        `;

    colorSettings.innerHTML =
      companyColorHtml + departmentColorsHtml + resetButtonHtml;

    // リセットボタンのイベントリスナーを追加
    const resetButton = document.getElementById("resetBtn");
    if (resetButton) {
      resetButton.addEventListener("click", () => this.resetColorsToDefault());
    }

    // color-itemのホバーとフォーカスイベントを追加
    const colorItems = colorSettings.querySelectorAll(".color-item");
    colorItems.forEach((item) => {
      const colorInput = item.querySelector('input[type="color"]');
      const label = item.querySelector(".color-label");
      const textInput = item.querySelector(".color-setting-text");

      // ホバーイベント
      if (item && label && textInput) {
        item.addEventListener("mouseenter", () => {
          label.style.display = "none";
          textInput.style.display = "block";
        });

        item.addEventListener("mouseleave", () => {
          if (document.activeElement !== textInput) {
            label.style.display = "block";
            textInput.style.display = "none";
          }
        });
      }

      // フォーカスイベント
      if (textInput && label) {
        textInput.addEventListener("focus", () => {
          label.style.display = "none";
          textInput.style.display = "block";
        });

        textInput.addEventListener("blur", () => {
          label.style.display = "block";
          textInput.style.display = "none";
        });
      }
    });

    // color inputとtext inputの連動処理を追加
    this.setupColorInputSync();
  }

  // カラー情報表示（非ログイン時）
  updateColorInfo() {
    const colorInfo = document.getElementById("colorInfo");
    if (!colorInfo) return;

    // 全社カラー設定
    const companyColorHtml = `
            <div class="color-item">
                <span class="colorInfo-block" style="background-color: ${this.companyDefaultColor};"></span>
                <label>JAMA</label>
            </div>
        `;

    // 部署カラー設定
    const departmentColorsHtml = this.departments
      .map((department) => {
        return `
                <div class="color-item">
                     <span class="colorInfo-block" style="background-color: ${department.default_color}; "></span>
                    <label>${department.name}</label>
                </div>
            `;
      })
      .join("");

    colorInfo.innerHTML = companyColorHtml + departmentColorsHtml;
  }

  // 権限チェック
  canEditReservation(reservation) {
    if (!this.isLoggedIn) return false;
    if (this.isAdmin) return true;

    // 作成者または同じ部署
    return (
      reservation.user_id === this.currentUser.id ||
      reservation.department_id === this.currentUser.department_id
    );
  }

  // 部署情報取得
  getDepartment(id) {
    return this.departments.find((dept) => dept.id == id);
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

    return "#718096";
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
        return this.userColorSettings["company"] || this.companyDefaultColor;
      } else {
        return this.companyDefaultColor; // ログインしていない場合の全社デフォルトカラー
      }
    }

    // 部署固有の場合 - department_idも試す
    const departmentId =
      reservation.user_department_id || reservation.department_id;
    return this.getDepartmentColor(departmentId);
  }

  // 配列形式のカラー設定をオブジェクト形式に変換
  convertArrayToObjectSettings(arraySettings) {
    const objectSettings = {};

    // 配列の各インデックスを部署IDまたは特別なキーにマッピング
    // インデックス0は全社（company）として扱う
    if (arraySettings[0] !== null && arraySettings[0] !== undefined) {
      objectSettings["company"] = arraySettings[0];
    }

    // インデックス1以降は部署ID（1, 2, 3...）として扱う
    for (let i = 1; i < arraySettings.length; i++) {
      if (arraySettings[i] !== null && arraySettings[i] !== undefined) {
        objectSettings[i.toString()] = arraySettings[i];
      }
    }

    return objectSettings;
  }

  // color inputとtext inputの連動処理設定
  setupColorInputSync() {
    const colorSettings = document.getElementById("colorSettings");
    if (!colorSettings) return;

    // 各color-itemの連動処理を設定
    const colorItems = colorSettings.querySelectorAll(".color-item");
    colorItems.forEach((item) => {
      const colorInput = item.querySelector('input[type="color"]');
      const textInput = item.querySelector('input[type="text"]');

      if (colorInput && textInput) {
        // color inputが変更された時にtext inputを更新
        colorInput.addEventListener("input", (e) => {
          textInput.value = e.target.value.toLowerCase();
        });

        // text inputが変更された時にcolor inputを更新
        textInput.addEventListener("input", (e) => {
          const value = e.target.value;
          // 有効なカラーコードかチェック（#で始まる6桁の16進数）
          if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
            colorInput.value = value.toLowerCase();
            // カラー設定を保存
            const changeEvent = { target: colorInput };
            this.handleColorChange(changeEvent);
          }
        });

        // text inputのフォーカスアウト時に正規化
        textInput.addEventListener("blur", (e) => {
          const value = e.target.value;
          if (!/^#[0-9A-Fa-f]{6}$/.test(value)) {
            // 無効な場合はcolor inputの値に戻す
            e.target.value = colorInput.value;
          }
        });
      }
    });
  }

  // カラー設定をデフォルトに戻す
  async resetColorsToDefault() {
    try {
      // ユーザー設定をクリア
      this.userColorSettings = {};

      // 全社カラーをデフォルトカラーに設定
      this.userColorSettings["company"] = this.companyDefaultColor;

      // サーバーに設定を保存
      await put("api/users.php?action=colors", {
        color_settings: this.userColorSettings,
      });

      // UI更新
      this.updateColorSettings();

      // カレンダー再描画
      if (window.calendarManager) {
        window.calendarManager.render();
      }

      showSuccessMessage(
        "カラー設定をデフォルトに戻しました",
        document.querySelector("#sidebar-message")
      );
    } catch (error) {
      showErrorMessage(
        "カラー設定のリセットに失敗しました",
        document.querySelector("#sidebar-message")
      );
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
      user: this.currentUser,
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
