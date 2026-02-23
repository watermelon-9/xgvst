export class QuoteDurableObject implements DurableObject {
  private readonly state: DurableObjectState;
  private readonly env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/ws' && request.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair) as [WebSocket, WebSocket];

      server.accept();
      server.addEventListener('message', (event) => {
        const msg = typeof event.data === 'string' ? event.data : '[binary]';
        server.send(JSON.stringify({ ok: true, echo: msg, source: 'quote-do' }));
      });
      server.addEventListener('close', () => server.close());

      return new Response(null, { status: 101, webSocket: client });
    }

    return Response.json({ ok: true, durableObject: 'QuoteDurableObject', ws: '/ws' });
  }
}
