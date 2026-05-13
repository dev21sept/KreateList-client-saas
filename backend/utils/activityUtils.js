/**
 * Simple activity logger stub
 */
const logActivity = async (data) => {
    console.log(`[ACTIVITY LOG] ${data.action} - ${data.status}`);
    // Future: Save to MongoDB Activity collection
};

module.exports = { logActivity };
