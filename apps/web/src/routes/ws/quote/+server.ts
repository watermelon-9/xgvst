import { env } from '$env/dynamic/public';
import type { RequestHandler } from './$types';

function resolveWorkerBaseUrl(): string {
	const configured = env.PUBLIC_WORKER_API_URL?.trim() || env.PUBLIC_API_URL?.trim();
	if (configured) {
		return configured.replace(/\/$/, '');
	}

	// Fallback for environments where public vars are not injected yet.
	return 'https://xgvst-workers.viehh642.workers.dev';
}

export const GET: RequestHandler = async ({ request, fetch }) => {
	if ((request.headers.get('upgrade') ?? '').toLowerCase() !== 'websocket') {
		return new Response(JSON.stringify({ ok: false, error: 'Expected websocket upgrade' }), {
			status: 426,
			headers: { 'content-type': 'application/json' }
		});
	}

	const target = `${resolveWorkerBaseUrl()}/ws/quote`;
	const headers = new Headers(request.headers);
	headers.delete('host');

	return fetch(new Request(target, { method: 'GET', headers }));
};
