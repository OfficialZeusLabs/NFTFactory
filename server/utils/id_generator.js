/**
 * ID Generator Utility
 * Generates unique IDs for various entities
 */

/**
 * Generate a unique submission ID
 * Format: SUB-{timestamp}-{random}
 */
export function generateSubmissionId() {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `SUB-${timestamp}-${random}`;
}

/**
 * Generate a unique redemption ID
 * Format: RDM-{timestamp}-{random}
 */
export function generateRedemptionId() {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `RDM-${timestamp}-${random}`;
}

/**
 * Generate a unique admin log ID
 * Format: LOG-{timestamp}-{random}
 */
export function generateLogId() {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `LOG-${timestamp}-${random}`;
}

/**
 * Generate a unique sale ID
 * Format: SALE-{timestamp}-{random}
 */
export function generateSaleId() {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `SALE-${timestamp}-${random}`;
}
