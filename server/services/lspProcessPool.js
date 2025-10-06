/**
 * lspProcessPool.js - LSP Process Pool Manager
 * Manages a pool of reusable pylsp processes for multiple users
 * Prevents memory leaks from spawning unlimited processes
 */

const { spawn } = require('child_process');
const logger = require('../utils/logger');
const { WORKSPACE_ROOT } = require('../utils/pathUtils');

class LSPProcessPool {
    constructor(options = {}) {
        this.maxProcesses = options.maxProcesses || 20; // Maximum concurrent processes
        this.idleTimeout = options.idleTimeout || 300000; // 5 minutes idle timeout
        this.processes = new Map(); // userId -> { process, lastUsed, inUse }
        this.waitQueue = []; // Queue of waiting WebSocket connections

        // Periodic cleanup of idle processes
        this.cleanupInterval = setInterval(() => {
            this.cleanupIdleProcesses();
        }, 60000); // Check every minute
    }

    /**
     * Get or create a pylsp process for a user
     */
    async getProcess(userId) {
        // Check if user already has a process
        if (this.processes.has(userId)) {
            const processInfo = this.processes.get(userId);
            processInfo.lastUsed = Date.now();
            processInfo.inUse = true;
            return processInfo.process;
        }

        // Check if we've reached the limit
        if (this.processes.size >= this.maxProcesses) {
            // Try to reclaim an idle process
            const reclaimedProcess = this.reclaimIdleProcess();
            if (reclaimedProcess) {
                this.processes.delete(reclaimedProcess.userId);
                return this.createProcess(userId);
            }

            // Queue is full, wait for a process to become available
            logger.warn('LSP process pool full, queuing request', {
                userId,
                currentSize: this.processes.size,
            });

            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('LSP process pool timeout'));
                }, 30000); // 30 second timeout

                this.waitQueue.push({
                    userId,
                    resolve: (process) => {
                        clearTimeout(timeout);
                        resolve(process);
                    },
                    reject,
                });
            });
        }

        // Create new process
        return this.createProcess(userId);
    }

    /**
     * Create a new pylsp process
     */
    createProcess(userId) {
        return new Promise((resolve, reject) => {
            try {
                const pylsp = spawn('pylsp', ['-v'], {
                    stdio: ['pipe', 'pipe', 'pipe'],
                    cwd: WORKSPACE_ROOT,
                    env: {
                        ...process.env,
                        PYTHONPATH:
                            WORKSPACE_ROOT +
                            ':/usr/local/lib/python3.11:/usr/local/lib/python3.11/site-packages',
                        PYTHONHOME: '/usr/local',
                    },
                });

                pylsp.on('error', (error) => {
                    logger.error('Failed to start pylsp in pool', {
                        userId,
                        error: error.message,
                    });
                    reject(error);
                });

                pylsp.on('exit', (code) => {
                    logger.info('pylsp process exited in pool', { userId, exitCode: code });
                    this.processes.delete(userId);

                    // Process next queued request if any
                    this.processQueue();
                });

                // Store process info
                this.processes.set(userId, {
                    process: pylsp,
                    lastUsed: Date.now(),
                    inUse: true,
                    userId,
                });

                logger.info('Created pylsp process in pool', {
                    userId,
                    poolSize: this.processes.size,
                });

                resolve(pylsp);
            } catch (error) {
                logger.error('Failed to spawn pylsp in pool', {
                    userId,
                    error: error.message,
                });
                reject(error);
            }
        });
    }

    /**
     * Release a process back to the pool (mark as not in use)
     */
    releaseProcess(userId) {
        const processInfo = this.processes.get(userId);
        if (processInfo) {
            processInfo.inUse = false;
            processInfo.lastUsed = Date.now();
            logger.debug('Released pylsp process to pool', {
                userId,
                poolSize: this.processes.size,
            });
        }

        // Process next queued request
        this.processQueue();
    }

    /**
     * Process queued requests
     */
    async processQueue() {
        if (this.waitQueue.length === 0) return;

        // Find an available process or create one if under limit
        if (this.processes.size < this.maxProcesses) {
            const queued = this.waitQueue.shift();
            try {
                const process = await this.createProcess(queued.userId);
                queued.resolve(process);
            } catch (error) {
                queued.reject(error);
            }
        }
    }

    /**
     * Find and reclaim an idle process
     */
    reclaimIdleProcess() {
        const now = Date.now();

        for (const [userId, info] of this.processes.entries()) {
            if (!info.inUse && now - info.lastUsed > 60000) {
                // 1 minute idle
                logger.info('Reclaiming idle pylsp process', { userId });
                info.process.kill();
                return { userId };
            }
        }

        return null;
    }

    /**
     * Cleanup idle processes
     */
    cleanupIdleProcesses() {
        const now = Date.now();
        const toRemove = [];

        for (const [userId, info] of this.processes.entries()) {
            if (!info.inUse && now - info.lastUsed > this.idleTimeout) {
                toRemove.push(userId);
            }
        }

        toRemove.forEach((userId) => {
            const info = this.processes.get(userId);
            if (info) {
                logger.info('Cleaning up idle pylsp process', {
                    userId,
                    idleTime: now - info.lastUsed,
                });
                info.process.kill();
                this.processes.delete(userId);
            }
        });

        if (toRemove.length > 0) {
            logger.info('Cleaned up idle processes', {
                count: toRemove.length,
                remaining: this.processes.size,
            });
        }
    }

    /**
     * Terminate a specific process
     */
    terminateProcess(userId) {
        const processInfo = this.processes.get(userId);
        if (processInfo) {
            logger.info('Terminating pylsp process', { userId });
            processInfo.process.kill();
            this.processes.delete(userId);
        }
    }

    /**
     * Get pool statistics
     */
    getStats() {
        const inUseCount = Array.from(this.processes.values()).filter((p) => p.inUse).length;

        return {
            totalProcesses: this.processes.size,
            inUse: inUseCount,
            idle: this.processes.size - inUseCount,
            queueLength: this.waitQueue.length,
            maxProcesses: this.maxProcesses,
        };
    }

    /**
     * Shutdown the pool
     */
    shutdown() {
        logger.info('Shutting down LSP process pool', {
            activeProcesses: this.processes.size,
        });

        clearInterval(this.cleanupInterval);

        // Kill all processes
        for (const [userId, info] of this.processes.entries()) {
            logger.debug('Killing pylsp process on shutdown', { userId });
            info.process.kill();
        }

        this.processes.clear();
        this.waitQueue = [];
    }
}

// Singleton instance
let poolInstance = null;

function getLSPProcessPool(options) {
    if (!poolInstance) {
        poolInstance = new LSPProcessPool(options);
    }
    return poolInstance;
}

module.exports = {
    LSPProcessPool,
    getLSPProcessPool,
};
