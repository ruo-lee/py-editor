/**
 * logger.js
 *
 * Structured logging utility for consistent log formatting
 */

const logger = {
    log(level, message, extra = {}) {
        const logEntry = {
            level: level.toUpperCase(),
            iso_datetime: new Date().toISOString(),
            module: 'py-editor',
            ...extra,
            message,
        };
        console.log(JSON.stringify(logEntry));
    },
    info(message, extra) {
        this.log('INFO', message, extra);
    },
    warn(message, extra) {
        this.log('WARN', message, extra);
    },
    error(message, extra) {
        this.log('ERROR', message, extra);
    },
    debug(message, extra) {
        if (process.env.DEBUG) {
            this.log('DEBUG', message, extra);
        }
    },
};

module.exports = logger;
