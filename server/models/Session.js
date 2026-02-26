// MongoDB Chat Session Model
const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
    role: { type: String, enum: ["user", "assistant", "system"], required: true },
    content: { type: String, required: true },
    language: { type: String, default: "en" },
    emotion: { type: String, default: "neutral" },
    timestamp: { type: Date, default: Date.now },
});

const sessionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    messages: [messageSchema],
    metadata: {
        riskScore: { type: Number, default: 0 },
        emotionHistory: [String],
        language: { type: String, default: "en" },
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

sessionSchema.pre("save", function (next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model("Session", sessionSchema);
