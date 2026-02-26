// MongoDB User Model
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    phone: { type: String, unique: true, sparse: true, trim: true },
    password: { type: String },
    gender: { type: String, enum: ["male", "female", "neutral"], default: "neutral" },
    language: { type: String, enum: ["en", "hi", "mr"], default: "en" },
    googleId: { type: String, unique: true, sparse: true },
    avatar: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
    lastLogin: { type: Date, default: Date.now },
});

userSchema.pre("save", async function (next) {
    if (this.isModified("password") && this.password) {
        this.password = await bcrypt.hash(this.password, 10);
    }
    next();
});

userSchema.methods.comparePassword = function (candidate) {
    return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toSafe = function () {
    const obj = this.toObject();
    delete obj.password;
    return obj;
};

module.exports = mongoose.model("User", userSchema);
