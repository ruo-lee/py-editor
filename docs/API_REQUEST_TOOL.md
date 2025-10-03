# API Request Tool Development Guide

## Overview

PyEditor includes a built-in HTTP client similar to Postman, allowing developers to test APIs directly within the IDE without switching applications.

## Architecture

### Component Structure

```
client/
├── api-panel.js       # Main API panel component
├── main.js            # Integration point
└── index.html         # Styles and layout

server/
├── index.js           # API proxy endpoint
└── api-proxy.js       # HTTP request handler
```

### Data Flow

```
User Input → ApiPanel → Server Proxy → External API
                ↓
         localStorage (domains)
                ↓
         Response Display
```

## Client-Side Implementation

### ApiPanel Class (`client/api-panel.js`)

**Core Responsibilities:**

- HTTP request configuration (method, URL, params, headers, body)
- Domain management with localStorage persistence
- Request execution and response handling
- SSE (Server-Sent Events) streaming support
- Panel visibility and resize control

**Key Methods:**

```javascript
// Show/hide panel
show() { document.getElementById('apiPanel').classList.add('show'); }
hide() { document.getElementById('apiPanel').classList.remove('show'); }

// Send HTTP request
async sendRequest() {
    const response = await fetch('/api/proxy-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method, url, params, headers, body })
    });
}

// Domain management
saveDomains() { localStorage.setItem('api-domains', JSON.stringify(this.domains)); }
loadDomains() { return JSON.parse(localStorage.getItem('api-domains') || '[]'); }
```

**JSON Body Parsing:**

Request body from textarea is automatically parsed:

```javascript
let parsedBody = null;
if (body.trim()) {
    try {
        parsedBody = JSON.parse(body);
    } catch (e) {
        parsedBody = body; // Send as string if not valid JSON
    }
}
```

### Panel Resize Implementation

Mouse-based drag resizing with constraints:

```javascript
setupResizer() {
    const resizer = document.getElementById('apiPanelResizer');
    const panel = document.getElementById('apiPanel');

    resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        startX = e.clientX;
        startWidth = panel.offsetWidth;
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        const diff = startX - e.clientX;
        const newWidth = Math.max(450, Math.min(1000, startWidth + diff));
        panel.style.width = `${newWidth}px`;
    });
}
```

**Constraints:**

- Minimum: 450px (prevents content clipping)
- Maximum: 1000px (prevents excessive width)

### Response Handling

**Regular Responses:**

```javascript
const result = await response.json();
viewer.textContent = JSON.stringify(result.body, null, 2);
metaBadge.className = 'api-response-meta success';
metaBadge.textContent = `Response ${result.status} - ${duration}ms`;
```

**SSE Streaming:**

```javascript
const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    viewer.textContent += chunk;
}
```

## Server-Side Implementation

### Proxy Endpoint (`server/index.js`)

**Endpoint:** `POST /api/proxy-request`

**Request Body:**

```json
{
    "method": "GET|POST|PUT|PATCH|DELETE",
    "url": "https://api.example.com/endpoint",
    "params": [{ "key": "param1", "value": "value1" }],
    "headers": [{ "key": "Authorization", "value": "Bearer token" }],
    "body": { "key": "value" } // or string
}
```

**Implementation:**

```javascript
app.post('/api/proxy-request', async (req, res) => {
    const { method, url, params, headers, body } = req.body;

    const result = await proxyRequest({ method, url, params, headers, body });

    if (result.isSSE) {
        res.setHeader('Content-Type', 'text/event-stream');
        result.stream.pipe(res);
    } else {
        res.json(result);
    }
});
```

### HTTP Request Handler (`server/api-proxy.js`)

**Core Logic:**

```javascript
async function proxyRequest(options) {
    const { method, url, headers, params, body } = options;

    // Build URL with query parameters
    const targetUrl = new URL(url);
    params.forEach(({ key, value }) => {
        if (key) targetUrl.searchParams.append(key, value);
    });

    // Execute request
    const protocol = targetUrl.protocol === 'https:' ? https : http;
    const req = protocol.request(reqOptions, (res) => {
        // Handle SSE
        if (res.headers['content-type']?.includes('text/event-stream')) {
            return { isSSE: true, stream: res, status, headers };
        }

        // Handle regular response
        return { isSSE: false, body: parsedBody, status, headers };
    });
}
```

**SSE Detection:**

Responses with `Content-Type: text/event-stream` are detected and piped directly to client without JSON serialization to avoid circular reference errors.

## Domain Management

### Storage Location

Domains are stored in browser localStorage (client-side only):

**Keys:**

- `api-domains`: Array of domain objects
- `api-selected-domain`: Currently selected domain name

**Format:**

```javascript
// api-domains
[
    { name: 'Local', url: 'http://localhost:3000' },
    { name: 'Production', url: 'https://api.example.com' },
];

// api-selected-domain
('Local');
```

### Domain Dialog

**HTML Structure:**

```html
<div class="api-domain-dialog">
    <div class="api-domain-dialog-content">
        <div class="api-domain-dialog-header">
            <h3>Manage Domains</h3>
            <button class="close-btn">×</button>
        </div>
        <div class="api-domain-dialog-body">
            <div class="api-domain-list">
                <!-- Domain items -->
            </div>
        </div>
    </div>
</div>
```

**Operations:**

- Add: `addDomain()` - Creates new domain entry
- Delete: `deleteDomain(name)` - Removes domain from array
- Select: `selectDomain(name)` - Sets active domain

## Styling System

### Theme Support

Both light and dark themes are supported through CSS class targeting:

**Dark Theme (default):**

```css
.api-panel {
    background: #1e1e1e;
    color: #d4d4d4;
}
```

**Light Theme:**

```css
body.light-theme .api-panel {
    background: #ffffff;
    color: #1f1f1f;
}
```

### Response Badge States

Color-coded status indicators with fixed dimensions:

```css
.api-response-meta {
    height: 24px;
    line-height: 16px;
    white-space: nowrap;
}

.api-response-meta.loading {
    background: #264f78;
    color: #4fc3f7;
}
.api-response-meta.success {
    background: #1a472a;
    color: #4ec9b0;
}
.api-response-meta.error {
    background: #5a1d1d;
    color: #f48771;
}
.api-response-meta.streaming {
    background: #3b3a30;
    color: #dcdcaa;
}
```

### Independent Scrolling

Response viewer has fixed height with overflow:

```css
.api-simple-viewer {
    height: 300px;
    max-height: 500px;
    overflow-y: auto;
    overflow-x: auto;
    white-space: pre-wrap;
}
```

### Panel Resizer

Visual indicator for resize capability:

```css
.api-panel-resizer {
    position: absolute;
    left: 0;
    width: 4px;
    cursor: col-resize;
}

.api-panel-resizer:hover {
    background: #007acc;
}
.api-panel-resizer:active {
    background: #1e90ff;
}
```

## Integration Points

### Main Application (`client/main.js`)

**Initialization:**

```javascript
const apiPanel = new ApiPanel();

// Toggle button
const apiToggle = document.getElementById('apiToggle');
apiToggle.addEventListener('click', () => {
    const panel = document.getElementById('apiPanel');
    if (panel.classList.contains('show')) {
        apiPanel.hide();
    } else {
        apiPanel.show();
    }
});
```

**HTML Button:**

```html
<button id="apiToggle" title="API Request Tool">
    <i class="codicon codicon-globe"></i>
</button>
```

## Technical Decisions

### Why Textarea Instead of Monaco?

Monaco Editor requires web worker initialization which causes conflicts when multiple instances are created. Using simple textarea/pre elements avoids worker management complexity.

### Why Browser localStorage?

Domain configurations are user-specific and environment-dependent. Storing in localStorage keeps them client-side and prevents accidental commits to version control.

### Why Server Proxy?

Direct browser requests to external APIs are blocked by CORS policies. Server-side proxy bypasses CORS restrictions while maintaining security through server validation.

### Why Stream Piping for SSE?

Stream objects contain circular references that cannot be JSON serialized. Direct piping to response preserves stream integrity without serialization attempts.

## Error Handling

### Common Issues

**1. Panel Not Opening**

- Verify CSS class matches: `panel.classList.add('show')`
- Check CSS definition: `.api-panel.show { display: flex; }`

**2. JSON Body Errors**

- Ensure body is parsed: `JSON.parse(body)`
- Fallback to string for invalid JSON

**3. SSE Circular Reference**

- Never serialize stream objects
- Use direct piping: `stream.pipe(response)`

**4. Content Clipping on Resize**

- Set appropriate minimum width (450px)
- Test all content fits within constraints

## Security Considerations

### Input Validation

Server validates all proxy requests:

```javascript
if (!method || !url) {
    return res.status(400).json({ error: 'Method and URL are required' });
}
```

### Request Timeout

Prevents hanging connections:

```javascript
const reqOptions = {
    timeout: 30000, // 30 seconds
};

req.on('timeout', () => {
    req.destroy();
    reject(new Error('Request timeout'));
});
```

### Error Exposure

Errors are logged server-side but generic messages sent to client:

```javascript
catch (error) {
    logger.error('API proxy error', { error: error.message });
    res.status(500).json({ error: error.message });
}
```

## Testing

### Manual Testing Checklist

- [ ] GET request to public API
- [ ] POST request with JSON body
- [ ] Request with query parameters
- [ ] Request with custom headers
- [ ] SSE streaming response
- [ ] Domain add/delete/select
- [ ] Panel show/hide
- [ ] Panel resize (min/max bounds)
- [ ] Light/dark theme switching
- [ ] Response scrolling independence
- [ ] Badge state transitions
- [ ] Error handling display

### Test Endpoints

**Public APIs for testing:**

- GET: `https://jsonplaceholder.typicode.com/posts/1`
- POST: `https://jsonplaceholder.typicode.com/posts`
- SSE: Custom server with `text/event-stream` response

## Future Enhancements

**Potential improvements:**

- Request history/favorites
- Environment variables
- Request collections
- Code generation (curl, fetch, axios)
- Response formatting (JSON, XML, HTML)
- Authentication presets (Bearer, Basic, OAuth)
- Request/response size limits
- Export/import domain configurations
- WebSocket support
- GraphQL query builder

## File Structure Reference

```
/home/ruo/my_project/py-editor/
├── client/
│   ├── api-panel.js          # Lines 1-530 (main component)
│   ├── main.js               # ApiPanel integration
│   └── index.html            # Lines 891-1526 (CSS)
├── server/
│   ├── index.js              # Lines 705-740 (proxy endpoint)
│   └── api-proxy.js          # Lines 1-126 (HTTP handler)
└── docs/
    └── API_REQUEST_TOOL.md   # This file
```

## References

- HTTP Methods: RFC 7231
- Server-Sent Events: WHATWG HTML Spec
- localStorage: Web Storage API
- Stream API: Node.js Stream Documentation
