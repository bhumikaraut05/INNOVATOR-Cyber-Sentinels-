// ============================================================
// ServiceNow Service — Incident CRUD with retry
// Centralized ServiceNow REST API integration
// ============================================================

const SNOW_INSTANCE = process.env.SERVICENOW_INSTANCE || "";
const SNOW_USER = process.env.SERVICENOW_USER || "";
const SNOW_PASSWORD = process.env.SERVICENOW_PASSWORD || "";

// In-memory fallback
let incidentCounter = 1000;
const localIncidents = [];

function isConfigured() {
    return !!(SNOW_INSTANCE && SNOW_USER && SNOW_PASSWORD);
}

function getAuthHeader() {
    return "Basic " + Buffer.from(`${SNOW_USER}:${SNOW_PASSWORD}`).toString("base64");
}

// ── Retry Wrapper ────────────────────────────────────
async function withRetry(fn, maxRetries = 3, baseDelay = 1000) {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;
            console.warn(`⚠️ ServiceNow attempt ${attempt}/${maxRetries} failed: ${err.message}`);
            if (attempt < maxRetries) {
                const delay = baseDelay * Math.pow(2, attempt - 1);
                await new Promise(r => setTimeout(r, delay));
            }
        }
    }
    throw lastError;
}

// ── Create Incident ──────────────────────────────────
async function createIncident(data) {
    const {
        short_description,
        description = "",
        caller_id = "",
        urgency = "2",
        category = "Financial Fraud",
        subcategory = "Account Compromise",
        impact = "2",
        priority = "2",
        assignment_group = "Fraud Response Team",
        contact_type = "AI Chatbot",
        // Custom fields
        u_risk_score = 0,
        u_emotion_detected = "neutral",
        u_transcript = "",
        u_channel = "AI Avatar Chatbot",
        u_caller_phone = "",
        u_caller_email = "",
    } = data;

    if (!short_description) throw new Error("short_description is required");

    const incidentData = {
        short_description,
        description: description || short_description,
        caller_id,
        urgency,
        category,
        subcategory,
        impact,
        priority,
        assignment_group,
        contact_type,
        u_risk_score,
        u_emotion_detected,
        u_transcript: (u_transcript || "").substring(0, 2000),
        u_channel,
        u_caller_phone,
        u_caller_email,
    };

    // Real ServiceNow API
    if (isConfigured()) {
        return withRetry(async () => {
            const url = `https://${SNOW_INSTANCE}/api/now/table/incident`;
            const resp = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "Authorization": getAuthHeader(),
                },
                body: JSON.stringify(incidentData),
            });
            if (!resp.ok) {
                const text = await resp.text();
                throw new Error(`ServiceNow API ${resp.status}: ${text}`);
            }
            const json = await resp.json();
            console.log(`🎫 ServiceNow Incident: ${json.result.number}`);
            return {
                success: true,
                number: json.result.number,
                sys_id: json.result.sys_id,
                state: json.result.state,
                priority: json.result.priority,
                simulated: false,
            };
        });
    }

    // Simulated incident
    incidentCounter++;
    const now = new Date();
    const simulated = {
        success: true,
        sys_id: `sim_${Date.now()}`,
        number: `INC${incidentCounter}`,
        state: "New",
        priority: priority === "1" ? "Critical" : priority === "2" ? "High" : "Medium",
        created_on: now.toISOString(),
        sla_target: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        simulated: true,
        ...incidentData,
    };

    localIncidents.unshift(simulated);
    console.log(`🎫 Simulated Incident: ${simulated.number} — ${short_description}`);
    return simulated;
}

// ── Get Incidents ────────────────────────────────────
async function getIncidents(limit = 20) {
    if (isConfigured()) {
        return withRetry(async () => {
            const url = `https://${SNOW_INSTANCE}/api/now/table/incident?sysparm_limit=${limit}&sysparm_order_by=-sys_created_on&sysparm_query=contact_type=AI Chatbot`;
            const resp = await fetch(url, {
                headers: { Accept: "application/json", Authorization: getAuthHeader() },
            });
            if (!resp.ok) throw new Error(`ServiceNow API ${resp.status}`);
            const json = await resp.json();
            return { incidents: json.result, simulated: false };
        });
    }
    return { incidents: localIncidents.slice(0, limit), simulated: true };
}

// ── Get Single Incident ──────────────────────────────
async function getIncident(id) {
    if (isConfigured()) {
        return withRetry(async () => {
            const url = `https://${SNOW_INSTANCE}/api/now/table/incident?sysparm_query=number=${id}`;
            const resp = await fetch(url, {
                headers: { Accept: "application/json", Authorization: getAuthHeader() },
            });
            if (!resp.ok) throw new Error(`ServiceNow API ${resp.status}`);
            const json = await resp.json();
            return json.result?.[0] || null;
        });
    }
    return localIncidents.find(i => i.number === id || i.sys_id === id) || null;
}

// ── Update Incident ──────────────────────────────────
async function updateIncident(id, data) {
    if (isConfigured()) {
        return withRetry(async () => {
            const incident = await getIncident(id);
            if (!incident) throw new Error("Incident not found");
            const url = `https://${SNOW_INSTANCE}/api/now/table/incident/${incident.sys_id}`;
            const resp = await fetch(url, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                    Authorization: getAuthHeader(),
                },
                body: JSON.stringify(data),
            });
            if (!resp.ok) throw new Error(`ServiceNow API ${resp.status}`);
            const json = await resp.json();
            return json.result;
        });
    }
    const found = localIncidents.find(i => i.number === id || i.sys_id === id);
    if (!found) throw new Error("Incident not found");
    Object.assign(found, data, { updated_on: new Date().toISOString() });
    return found;
}

// ── Get Local Incidents (for legacy routes) ──────────
function getLocalIncidents() { return localIncidents; }

module.exports = {
    createIncident,
    getIncidents,
    getIncident,
    updateIncident,
    getLocalIncidents,
    isConfigured,
    withRetry,
};
