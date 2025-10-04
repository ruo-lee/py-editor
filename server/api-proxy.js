/**
 * API Proxy Module
 * Handles HTTP requests forwarding with support for JSON and SSE responses
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

/**
 * Send HTTP request and handle response (JSON and SSE)
 * @param {Object} options - Request options
 * @returns {Promise<Object>} Response data
 */
async function proxyRequest(options) {
    const { method, url, headers = [], params = [], body = null } = options;

    return new Promise((resolve, reject) => {
        try {
            // Parse URL
            let targetUrl = new URL(url);

            // Add query parameters
            params.forEach(({ key, value }) => {
                if (key) {
                    targetUrl.searchParams.append(key, value);
                }
            });

            // Prepare headers
            const requestHeaders = {};
            headers.forEach(({ key, value }) => {
                if (key) {
                    requestHeaders[key] = value;
                }
            });

            // Add Content-Type for POST/PUT/PATCH with body
            if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
                if (!requestHeaders['Content-Type']) {
                    requestHeaders['Content-Type'] = 'application/json';
                }
            }

            // Select protocol module
            const protocol = targetUrl.protocol === 'https:' ? https : http;

            // Request options
            const reqOptions = {
                method,
                hostname: targetUrl.hostname,
                port: targetUrl.port,
                path: targetUrl.pathname + targetUrl.search,
                headers: requestHeaders,
                timeout: 30000, // 30 seconds timeout
            };

            const req = protocol.request(reqOptions, (res) => {
                const chunks = [];
                const contentType = res.headers['content-type'] || '';

                // Handle SSE (Server-Sent Events)
                if (contentType.includes('text/event-stream')) {
                    resolve({
                        isSSE: true,
                        status: res.statusCode,
                        statusText: res.statusMessage,
                        headers: res.headers,
                        stream: res,
                    });
                    return;
                }

                // Handle regular responses
                res.on('data', (chunk) => {
                    chunks.push(chunk);
                });

                res.on('end', () => {
                    const buffer = Buffer.concat(chunks);
                    const responseBody = buffer.toString('utf-8');

                    // Try to parse as JSON
                    let parsedBody = responseBody;
                    try {
                        parsedBody = JSON.parse(responseBody);
                    } catch (e) {
                        // Not JSON, keep as string
                    }

                    resolve({
                        isSSE: false,
                        status: res.statusCode,
                        statusText: res.statusMessage,
                        headers: res.headers,
                        body: parsedBody,
                    });
                });
            });

            req.on('error', (error) => {
                reject(new Error(`Request failed: ${error.message}`));
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            // Send body if present
            if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
                const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
                req.write(bodyString);
            }

            req.end();
        } catch (error) {
            reject(new Error(`Invalid request: ${error.message}`));
        }
    });
}

module.exports = { proxyRequest };
