// Auth Routes — Email/Password, Google OAuth, OTP
const router = require("express").Router();
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";
const TOKEN_EXPIRY = "7d";

function makeToken(user) {
    return jwt.sign({ id: user._id, email: user.email, name: user.name, gender: user.gender, language: user.language }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

// ── Sign Up ──────────────────────────────────────────
router.post("/signup", async (req, res) => {
    try {
        const { name, email, phone, password, gender, language } = req.body;
        if (!name || !email || !password) return res.status(400).json({ error: "Name, email, and password are required." });

        const exists = await User.findOne({ $or: [{ email }, ...(phone ? [{ phone }] : [])] });
        if (exists) return res.status(409).json({ error: "Account already exists." });

        const user = await User.create({ name, email, phone, password, gender: gender || "neutral", language: language || "en" });
        const token = makeToken(user);
        res.status(201).json({ token, user: user.toSafe(), isNew: true });
    } catch (err) {
        if (err.code === 11000) return res.status(409).json({ error: "Account already exists." });
        res.status(500).json({ error: err.message });
    }
});

// ── Sign In (Email/Phone + Password) ─────────────────
router.post("/signin", async (req, res) => {
    try {
        const { identifier, password } = req.body;
        if (!identifier || !password) return res.status(400).json({ error: "Email/phone and password required." });

        const user = await User.findOne({ $or: [{ email: identifier.toLowerCase() }, { phone: identifier }] });
        if (!user) return res.status(404).json({ error: "Account not found." });
        if (!user.password) return res.status(400).json({ error: "Use Google or OTP to sign in." });

        const valid = await user.comparePassword(password);
        if (!valid) return res.status(401).json({ error: "Incorrect password." });

        user.lastLogin = new Date();
        await user.save();

        const token = makeToken(user);
        res.json({ token, user: user.toSafe(), isNew: false });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Google OAuth Token Verify ────────────────────────
router.post("/google", async (req, res) => {
    try {
        const { credential } = req.body;
        // Decode Google JWT (in production, verify with Google's public keys)
        const payload = JSON.parse(Buffer.from(credential.split(".")[1], "base64url").toString());

        let user = await User.findOne({ googleId: payload.sub });
        if (!user) {
            user = await User.findOne({ email: payload.email });
            if (user) {
                user.googleId = payload.sub;
                await user.save();
            } else {
                user = await User.create({
                    name: payload.name,
                    email: payload.email,
                    googleId: payload.sub,
                    gender: "neutral",
                });
            }
        }
        user.lastLogin = new Date();
        await user.save();

        const token = makeToken(user);
        res.json({ token, user: user.toSafe(), isNew: !user.lastLogin });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── OTP Send (simulated) ────────────────────────────
const otpStore = new Map();

router.post("/otp/send", async (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: "Phone number required." });

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    otpStore.set(phone, { otp, expires: Date.now() + 5 * 60 * 1000 });
    console.log(`📱 OTP for ${phone}: ${otp}`);
    res.json({ message: "OTP sent to your phone.", hint: otp }); // hint only in dev
});

// ── OTP Verify ──────────────────────────────────────
router.post("/otp/verify", async (req, res) => {
    const { phone, otp, name } = req.body;
    const stored = otpStore.get(phone);
    if (!stored || stored.otp !== otp || Date.now() > stored.expires) {
        return res.status(401).json({ error: "Invalid or expired OTP." });
    }
    otpStore.delete(phone);

    let user = await User.findOne({ phone });
    const isNew = !user;
    if (!user) {
        user = await User.create({ name: name || "User", phone, gender: "neutral" });
    }
    user.lastLogin = new Date();
    await user.save();

    const token = makeToken(user);
    res.json({ token, user: user.toSafe(), isNew });
});

// ── Get Current User ─────────────────────────────────
const authMiddleware = require("../middleware/auth");
router.get("/me", authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ error: "User not found" });
        res.json({ user: user.toSafe() });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
