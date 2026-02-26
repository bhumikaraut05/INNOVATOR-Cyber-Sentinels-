// ============================================================
// Auth — Sign Up / Sign In with CRM simulation (localStorage)
// Face recognition login support
// ============================================================

const CRM_KEY = "securebank_crm_users";

function getUsers() {
    try { return JSON.parse(localStorage.getItem(CRM_KEY)) || []; }
    catch { return []; }
}

function saveUsers(users) {
    localStorage.setItem(CRM_KEY, JSON.stringify(users));
}

/**
 * Sign up a new user.
 * @returns {{ success:boolean, user?:object, error?:string }}
 */
function signUp({ name, phone, email, gender, password }) {
    if (!name || !phone || !email || !password) {
        return { success: false, error: "All fields are required." };
    }

    const users = getUsers();

    // Check duplicate phone / email
    if (users.find(u => u.phone === phone)) {
        return { success: false, error: "Phone number already registered." };
    }
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
        return { success: false, error: "Email already registered." };
    }

    const user = {
        id: "CUST-" + Date.now().toString(36).toUpperCase(),
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim().toLowerCase(),
        gender: gender || "neutral", // male / female / neutral
        password, // In production: hash this!
        createdAt: new Date().toISOString(),
        isNew: true,
    };

    users.push(user);
    saveUsers(users);
    setCurrentUser(user);
    return { success: true, user };
}

/**
 * Sign in with phone/email + password.
 * @returns {{ success:boolean, user?:object, error?:string }}
 */
function signIn(identifier, password) {
    if (!identifier || !password) {
        return { success: false, error: "Please enter your phone/email and password." };
    }

    const users = getUsers();
    const id = identifier.trim().toLowerCase();
    const user = users.find(u =>
        u.phone === id || u.email === id
    );

    if (!user) return { success: false, error: "Account not found. Please sign up first." };
    if (user.password !== password) return { success: false, error: "Incorrect password. Please try again." };

    // Mark as returning user
    user.isNew = false;
    saveUsers(users);
    setCurrentUser(user);
    return { success: true, user };
}

/**
 * Session management
 */
function setCurrentUser(user) {
    const safe = { ...user };
    delete safe.password;
    sessionStorage.setItem("securebank_session", JSON.stringify(safe));
}

function getCurrentUser() {
    try { return JSON.parse(sessionStorage.getItem("securebank_session")); }
    catch { return null; }
}

function logout() {
    sessionStorage.removeItem("securebank_session");
}

function isLoggedIn() {
    return !!getCurrentUser();
}

export { signUp, signIn, getCurrentUser, logout, isLoggedIn };
