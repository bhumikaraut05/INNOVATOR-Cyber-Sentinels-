// ============================================================
// ServiceNow Integration — Incident Management API
// Creates, retrieves, and manages incidents for fraud/complaints
// ============================================================
const router = require("express").Router();
const authMiddleware = require("../middleware/auth");

const SNOW_INSTANCE = process.env.SERVICENOW_INSTANCE || ""; // e.g., "dev12345.service-now.com"
const SNOW_USER = process.env.SERVICENOW_USER || "";
const SNOW_PASSWORD = process.env.SERVICENOW_PASSWORD || "";

// In-memory incident store (used when ServiceNow is not configured)
let incidentCounter = 1000;
const localIncidents = [];

// ── Create Incident ──────────────────────────────────
router.post("/incident", authMiddleware, async (req, res) => {
    try {
        const {
            category = "Financial Fraud",
            subcategory = "Account Compromise",
            priority = "2",
            shortDescription,
            description,
            riskScore = 0,
            emotion = "neutral",
            transcript = "",
            callerPhone = "",
            callerEmail = "",
            callerName = "",
        } = req.body;

        if (!shortDescription) return res.status(400).json({ error: "Short description required." });

        const incident = {
            category,
            subcategory,
            priority,
            short_description: shortDescription,
            description: description || shortDescription,
            assignment_group: "Fraud Response Team",
            caller_id: callerName,
            contact_type: "AI Chatbot",
            u_risk_score: riskScore,
            u_emotion_detected: emotion,
            u_transcript: transcript.substring(0, 2000),
            u_channel: "AI Avatar Chatbot",
            u_caller_phone: callerPhone,
            u_caller_email: callerEmail,
        };

        // If ServiceNow is configured, call the real API
        if (SNOW_INSTANCE && SNOW_USER && SNOW_PASSWORD) {
            const result = await createSNOWIncident(incident);
            return res.status(201).json({
                success: true,
                ticketNumber: result.number,
                sysId: result.sys_id,
                state: result.state,
                message: `Incident ${result.number} created successfully.`,
            });
        }

        // Simulated incident
        incidentCounter++;
        const simulated = {
            sys_id: `sim_${Date.now()}`,
            number: `INC${incidentCounter}`,
            state: "New",
            priority: priority === "1" ? "Critical" : priority === "2" ? "High" : "Medium",
            created_on: new Date().toISOString(),
            ...incident,
        };
        localIncidents.unshift(simulated);
        console.log(`🎫 ServiceNow Incident Created: ${simulated.number} — ${shortDescription}`);

        res.status(201).json({
            success: true,
            ticketNumber: simulated.number,
            sysId: simulated.sys_id,
            state: simulated.state,
            priority: simulated.priority,
            message: `Incident ${simulated.number} has been created and assigned to Fraud Response Team.`,
            simulated: true,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Get All Incidents ────────────────────────────────
router.get("/incidents", authMiddleware, async (req, res) => {
    try {
        if (SNOW_INSTANCE && SNOW_USER && SNOW_PASSWORD) {
            const result = await fetchSNOWIncidents();
            return res.json({ incidents: result, simulated: false });
        }
        res.json({ incidents: localIncidents, simulated: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Get Single Incident ──────────────────────────────
router.get("/incident/:id", authMiddleware, async (req, res) => {
    try {
        if (SNOW_INSTANCE && SNOW_USER && SNOW_PASSWORD) {
            const result = await fetchSNOWIncident(req.params.id);
            return res.json(result);
        }
        const found = localIncidents.find(i => i.number === req.params.id || i.sys_id === req.params.id);
        if (!found) return res.status(404).json({ error: "Incident not found." });
        res.json(found);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Update Incident State ────────────────────────────
router.patch("/incident/:id", authMiddleware, async (req, res) => {
    try {
        const { state, notes } = req.body;
        if (SNOW_INSTANCE && SNOW_USER && SNOW_PASSWORD) {
            const result = await updateSNOWIncident(req.params.id, { state, work_notes: notes });
            return res.json(result);
        }
        const found = localIncidents.find(i => i.number === req.params.id || i.sys_id === req.params.id);
        if (!found) return res.status(404).json({ error: "Incident not found." });
        if (state) found.state = state;
        if (notes) found.work_notes = (found.work_notes || "") + "\n" + notes;
        found.updated_on = new Date().toISOString();
        res.json({ success: true, incident: found });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ════════════════════════════════════════════════════
//  ServiceNow REST API Calls
// ════════════════════════════════════════════════════

async function createSNOWIncident(data) {
    const url = `https://${SNOW_INSTANCE}/api/now/table/incident`;
    const resp = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": "Basic " + Buffer.from(`${SNOW_USER}:${SNOW_PASSWORD}`).toString("base64"),
        },
        body: JSON.stringify(data),
    });
    if (!resp.ok) throw new Error(`ServiceNow API error: ${resp.status}`);
    const json = await resp.json();
    return json.result;
}

async function fetchSNOWIncidents() {
    const url = `https://${SNOW_INSTANCE}/api/now/table/incident?sysparm_limit=20&sysparm_order_by=-sys_created_on&sysparm_query=contact_type=AI Chatbot`;
    const resp = await fetch(url, {
        headers: {
            "Accept": "application/json",
            "Authorization": "Basic " + Buffer.from(`${SNOW_USER}:${SNOW_PASSWORD}`).toString("base64"),
        },
    });
    if (!resp.ok) throw new Error(`ServiceNow API error: ${resp.status}`);
    const json = await resp.json();
    return json.result;
}

async function fetchSNOWIncident(id) {
    const url = `https://${SNOW_INSTANCE}/api/now/table/incident?sysparm_query=number=${id}`;
    const resp = await fetch(url, {
        headers: {
            "Accept": "application/json",
            "Authorization": "Basic " + Buffer.from(`${SNOW_USER}:${SNOW_PASSWORD}`).toString("base64"),
        },
    });
    if (!resp.ok) throw new Error(`ServiceNow API error: ${resp.status}`);
    const json = await resp.json();
    return json.result?.[0] || null;
}

async function updateSNOWIncident(id, data) {
    // First get sys_id from number
    const incident = await fetchSNOWIncident(id);
    if (!incident) throw new Error("Incident not found");
    const url = `https://${SNOW_INSTANCE}/api/now/table/incident/${incident.sys_id}`;
    const resp = await fetch(url, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": "Basic " + Buffer.from(`${SNOW_USER}:${SNOW_PASSWORD}`).toString("base64"),
        },
        body: JSON.stringify(data),
    });
    if (!resp.ok) throw new Error(`ServiceNow API error: ${resp.status}`);
    const json = await resp.json();
    return json.result;
}

// Export for use by chat/fraud engine
module.exports = router;
module.exports.createLocalIncident = (data) => {
    incidentCounter++;
    const inc = {
        sys_id: `sim_${Date.now()}`,
        number: `INC${incidentCounter}`,
        state: "New",
        priority: data.priority === "1" ? "Critical" : data.priority === "2" ? "High" : "Medium",
        created_on: new Date().toISOString(),
        ...data,
    };
    localIncidents.unshift(inc);
    console.log(`🎫 Auto-created: ${inc.number} — ${data.short_description}`);
    return inc;
};
module.exports.getLocalIncidents = () => localIncidents;
