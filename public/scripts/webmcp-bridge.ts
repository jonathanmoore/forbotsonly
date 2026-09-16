/**
 * WebMCP in-page bridge.
 *
 * The store's tool surface lives on the server (POST /mcp, JSON-RPC 2.0). This
 * module mirrors that same surface into the page via the in-page WebMCP API
 * (`document.modelContext`), so browser-resident agents — and the Chrome
 * DevTools "Application → WebMCP" panel — can see and call the tools without
 * knowing the JSON-RPC envelope.
 *
 * ## Expect this to be inert
 *
 * WebMCP is an origin trial in Chrome 149 / Edge 150 and on no stable channel.
 * `document.modelContext` only exists behind the `chrome://flags` WebMCP flag or
 * with a per-origin trial token in a `<meta http-equiv="origin-trial">` tag —
 * set `VITE_WEBMCP_ORIGIN_TRIAL_TOKEN` at build time to ship one. With neither,
 * the detect below returns and this file does nothing. That silence is the
 * expected state, not a fault; agents still get the full surface over /mcp.
 *
 * There is no second source of truth: tool names, descriptions, and schemas are
 * fetched from `tools/list` at runtime and every `execute` proxies straight
 * through to `tools/call`. Adding a tool in src/server.ts is enough.
 *
 * This is agent surface, not human UI — the human experience is still only the
 * physics pile (see the note at the top of index.html).
 */

const MCP_ENDPOINT = '/mcp';
const SESSION_STORAGE_KEY = 'forbotsonly:mcp-session-id';
const PROTOCOL_VERSION = '2024-11-05';

interface McpToolDefinition {
  name: string;
  description?: string;
  inputSchema?: unknown;
}

interface McpContent {
  type: string;
  text?: string;
}

/**
 * Session continuity across tool calls.
 *
 * The server accepts a session from several sources; in the browser the cookie
 * it sets would be enough on its own. We also persist the `Mcp-Session-Id` it
 * hands back so the session survives a reload with cookies blocked, and so the
 * id is available to echo into `sessionId` tool arguments.
 */
let sessionId: string | null = null;

function loadSessionId(): string | null {
  try {
    return window.sessionStorage.getItem(SESSION_STORAGE_KEY);
  } catch {
    return null; // Storage can be denied; the cookie still carries the session.
  }
}

function saveSessionId(id: string): void {
  sessionId = id;
  try {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, id);
  } catch {
    // Non-fatal.
  }
}

async function rpc(method: string, params?: Record<string, unknown>): Promise<any> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (sessionId) headers['Mcp-Session-Id'] = sessionId;

  const res = await fetch(MCP_ENDPOINT, {
    method: 'POST',
    headers,
    credentials: 'same-origin',
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params: params ?? {} }),
  });

  const returnedSession = res.headers.get('Mcp-Session-Id');
  if (returnedSession) saveSessionId(returnedSession);

  if (res.status === 204) return null;

  const body = await res.json();
  if (body.error) {
    throw new Error(body.error.message || `MCP error ${body.error.code}`);
  }
  return body.result;
}

/**
 * Some tools accept an explicit `sessionId` argument for hosts that drop
 * headers. When we have one and the tool takes it, fill it in so an in-page
 * agent never has to thread the session through by hand.
 */
function withSession(tool: McpToolDefinition, args: Record<string, unknown>): Record<string, unknown> {
  const schema = tool.inputSchema as { properties?: Record<string, unknown> } | undefined;
  if (!sessionId || args.sessionId || !schema?.properties?.sessionId) return args;
  return { ...args, sessionId };
}

function toModelContextTool(tool: McpToolDefinition) {
  return {
    name: tool.name,
    description: tool.description ?? '',
    inputSchema: tool.inputSchema ?? { type: 'object', properties: {} },
    async execute(args: Record<string, unknown> = {}) {
      const result = await rpc('tools/call', {
        name: tool.name,
        arguments: withSession(tool, args ?? {}),
      });

      const content: McpContent[] = result?.content ?? [];

      // identify_agent mints the session; capture it so later calls inherit it
      // even when the response header did not survive.
      const first = content[0];
      if (first?.type === 'text' && first.text) {
        try {
          const parsed = JSON.parse(first.text);
          if (typeof parsed?.sessionId === 'string') saveSessionId(parsed.sessionId);
        } catch {
          // Not every tool returns JSON.
        }
      }

      return { content };
    },
  };
}

/**
 * Ship the origin-trial token, if this build was given one.
 *
 * Injected from script rather than hardcoded in index.html because the token is
 * per-origin and expires; Chrome honours a meta tag added before the feature is
 * first touched. Vite inlines the env value at build time, so with no token
 * configured this compiles down to nothing.
 */
function applyOriginTrialToken(): void {
  const token = import.meta.env?.VITE_WEBMCP_ORIGIN_TRIAL_TOKEN;
  if (!token) return;
  const meta = document.createElement('meta');
  meta.httpEquiv = 'origin-trial';
  meta.content = token;
  document.head.appendChild(meta);
}

async function registerWebMcpTools(): Promise<void> {
  applyOriginTrialToken();

  // The API hangs off `document`, not `navigator`. Chrome's DevTools WebMCP panel
  // reads the former; navigator is checked only in case a build moves it back.
  const modelContext =
    (document as any).modelContext ?? (navigator as any).modelContext;
  if (!modelContext) return; // No in-page WebMCP support; /mcp still serves agents.

  sessionId = loadSessionId();

  await rpc('initialize', {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: 'forbotsonly-webmcp-bridge', version: '1.0.0' },
  });

  const { tools } = (await rpc('tools/list')) as { tools: McpToolDefinition[] };
  const pageTools = tools.map(toModelContextTool);

  // registerTool announces tools one at a time (what the DevTools panel lists);
  // provideContext is the batch form on builds that only implement that.
  if (typeof modelContext.registerTool === 'function') {
    // Returns a promise that rejects with NotAllowedError when the WebMCP
    // permission is off — a normal answer, not an error worth surfacing.
    await Promise.all(
      pageTools.map((pageTool) =>
        Promise.resolve(modelContext.registerTool(pageTool)).catch(() => {}),
      ),
    );
  } else if (typeof modelContext.provideContext === 'function') {
    modelContext.provideContext({ tools: pageTools });
  } else {
    return;
  }

  console.info(`[webmcp] registered ${pageTools.length} in-page tools`);
}

registerWebMcpTools().catch((err) => {
  // A failed bridge must never take down the page or the HTTP tool surface.
  console.warn('[webmcp] in-page tool registration failed:', err);
});
