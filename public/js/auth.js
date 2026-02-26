// ============================================================
// Auth Module — Frontend auth logic (API calls)
// ============================================================

const API = "/api/auth";

async function apiSignUp({ name, email, phone, password, gender, language }) {
    const res = await fetch(`${API}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, password, gender, language }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Sign up failed");
    saveSession(data.token, data.user, data.isNew);
    return data;
}

async function apiSignIn(identifier, password) {
    const res = await fetch(`${API}/signin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Sign in failed");
    saveSession(data.token, data.user, data.isNew);
    return data;
}

async function apiGoogleLogin(credential) {
    const res = await fetch(`${API}/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Google login failed");
    saveSession(data.token, data.user, data.isNew);
    return data;
}

async function apiSendOtp(phone) {
    const res = await fetch(`${API}/otp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "OTP send failed");
    return data;
}

async function apiVerifyOtp(phone, otp, name) {
    const res = await fetch(`${API}/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp, name }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "OTP verification failed");
    saveSession(data.token, data.user, data.isNew);
    return data;
}

function saveSession(token, user, isNew) {
    localStorage.setItem("sb_token", token);
    localStorage.setItem("sb_user", JSON.stringify({ ...user, isNew }));
}

function getToken() { return localStorage.getItem("sb_token"); }

function getUser() {
    try { return JSON.parse(localStorage.getItem("sb_user")); }
    catch { return null; }
}

function isLoggedIn() { return !!getToken(); }

function logout() {
    localStorage.removeItem("sb_token");
    localStorage.removeItem("sb_user");
}

export { apiSignUp, apiSignIn, apiGoogleLogin, apiSendOtp, apiVerifyOtp, getToken, getUser, isLoggedIn, logout };
