const { query } = require('../db');

/**
 * Log a user activity to the audit_logs table.
 * 
 * @param {string} userId - ID of the user performing the action.
 * @param {string} action - Description of the action (e.g., 'LOGIN', 'UPDATE_ROLE').
 * @param {string} targetType - Type of object being acted upon (e.g., 'user', 'portfolio').
 * @param {string} targetId - Specific ID of the target object.
 * @param {object} details - Any additional metadata or changes (mapped to JSONB).
 * @param {object} req - Express request object (optional, used to get IP and User-Agent).
 */
async function logActivity(userId, action, targetType = null, targetId = null, details = null, req = null) {
    try {
        let ipAddress = null;
        let userAgent = null;

        if (req) {
            ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
            userAgent = req.headers['user-agent'];
        }

        await query(`
            INSERT INTO audit_logs (
                user_id, action, target_type, target_id, details, ip_address, user_agent
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [userId, action, targetType, targetId, details ? JSON.stringify(details) : null, ipAddress, userAgent]);
        
    } catch (err) {
        // We don't want to crash the main app if logging fails, but we should log the error
        console.error('Failed to log audit activity:', err.message);
    }
}

module.exports = { logActivity };
