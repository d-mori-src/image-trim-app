// 簡易ログイン認証
const users = {
    "admin": "f470213d9ae659187a19b9cb2169b4b400544f4d3f59250eda657154700da616",
    "guest": "8605f70ff5f55e2a9323d97de3dbf8e61f38314d93298ca00e19f8918fe8971b",
};

// パスワードのSHA-256ハッシュ化
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

// ログイン状態の確認（リロード対策）
document.addEventListener("DOMContentLoaded", () => {
    const savedUser = localStorage.getItem("loggedInUser");
    if (savedUser && users[savedUser]) {
        showAppArea();
    } else {
        showLoginArea();
    }
});

// ログインボタンクリック処理
document.getElementById("login-button").addEventListener("click", async () => {
    const username = document.getElementById("login-username").value.trim();
    const password = document.getElementById("login-password").value;

    if (!users[username]) {
        document.getElementById("login-error").textContent = "ユーザー名が間違っています";
        return;
    }

    const hashed = await hashPassword(password);
    if (hashed !== users[username]) {
        document.getElementById("login-error").textContent = "パスワードが違います";
        return;
    }

    // ログイン成功
    localStorage.setItem("loggedInUser", username); // ←ここで保存
    showAppArea();
});

document.getElementById("login-password").addEventListener("keydown", async (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        document.getElementById("login-button").click();
    }
});

// ログアウト処理
document.getElementById("logout-button").addEventListener("click", () => {
    localStorage.removeItem("loggedInUser");
    showLoginArea();
});

// 表示切り替え関数
function showLoginArea() {
    document.getElementById("login-area").style.display = "block";
    document.getElementById("app-area").style.display = "none";
    document.getElementById("login-error").textContent = "";
}

function showAppArea() {
    document.getElementById("login-area").style.display = "none";
    document.getElementById("app-area").style.display = "block";
}