// ============================================================
// ServiceNow Integration — Simulated Incident Management
// ============================================================

let incidentCounter = 0;
const incidents = [];

/**
 * Create a ServiceNow incident record.
 * @param {object} data
 * @returns {object} incident record
 */
function createIncident(data) {
    incidentCounter++;
    const incidentId = `INC${String(incidentCounter).padStart(5, "0")}`;
    const now = new Date();

    const incident = {
        id: incidentId,
        number: incidentId,
        priority: "High",
        state: "New",
        category: "Financial Fraud",
        subcategory: data.subcategory || "Suspicious Transaction",
        shortDescription: data.shortDescription || "Fraud risk detected during banking session",
        description: data.description || "",
        assignmentGroup: "Fraud Investigation Team",
        assignedTo: "Auto-Assigned",

        // Customer details
        customerId: data.customerId || "CUST-UNKNOWN",
        customerName: data.customerName || "Unknown",
        customerPhone: data.customerPhone || "",

        // Risk data
        riskScore: data.riskScore || 0,
        riskLevel: data.riskLevel || "high",
        sentimentScore: data.sentimentScore || "negative",
        faceEmotion: data.faceEmotion || "neutral",

        // Transcript
        conversationTranscript: data.transcript || [],

        // Timestamps
        createdAt: now.toISOString(),
        slaTarget: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(), // 2-hour SLA
        slaRemaining: "2h 00m",

        // Flags
        crmFlagged: true,
        whatsAppAlertSent: true,
        escalated: true,

        // Actions taken
        actionsTaken: [
            `${now.toLocaleTimeString()} — Incident created automatically`,
            `${now.toLocaleTimeString()} — Assigned to Fraud Response Team`,
            `${now.toLocaleTimeString()} — SLA monitoring activated (2h target)`,
            `${now.toLocaleTimeString()} — CRM profile flagged`,
            `${now.toLocaleTimeString()} — WhatsApp secure alert triggered`,
        ],
    };

    incidents.push(incident);
    return incident;
}

/**
 * Get all incidents.
 */
function getAllIncidents() {
    return [...incidents];
}

/**
 * Get incident by ID.
 */
function getIncidentById(id) {
    return incidents.find(i => i.id === id) || null;
}

/**
 * Format incident for display as alert notification.
 */
function formatIncidentAlert(incident) {
    return {
        id: incident.id,
        priority: incident.priority,
        category: incident.category,
        assignmentGroup: incident.assignmentGroup,
        riskScore: incident.riskScore,
        riskLevel: incident.riskLevel,
        slaTarget: incident.slaTarget,
        createdAt: incident.createdAt,
        shortDescription: incident.shortDescription,
    };
}

/**
 * Format incident for detailed panel view.
 */
function formatIncidentDetail(incident) {
    return `━━━━━━━━━ ServiceNow Incident ━━━━━━━━━
Incident:    ${incident.id}
Priority:    ${incident.priority}
Category:    ${incident.category}
Status:      ${incident.state}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Customer:    ${incident.customerName} (${incident.customerId})
Risk Score:  ${incident.riskScore}/100 [${incident.riskLevel.toUpperCase()}]
Sentiment:   ${incident.sentimentScore}
Face Emotion:${incident.faceEmotion}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Assigned To: ${incident.assignmentGroup}
SLA Target:  2 hours
CRM Flagged: ✅
WhatsApp:    ✅ Alert Sent
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
}

/**
 * Reset incidents (for new session).
 */
function resetIncidents() {
    incidentCounter = 0;
    incidents.length = 0;
}

export {
    createIncident,
    getAllIncidents,
    getIncidentById,
    formatIncidentAlert,
    formatIncidentDetail,
    resetIncidents,
};
