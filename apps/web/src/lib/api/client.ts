import { mockUniverse } from './mock';
import type { UniverseResponse } from './types';

const API_BASE = import.meta.env.PUBLIC_API_URL?.trim() ?? '';

export async function fetchUniverse(): Promise<UniverseResponse> {
	if (!API_BASE) return mockUniverse;

	const res = await fetch(`${API_BASE}/v3/universe`, {
		headers: { Accept: 'application/json' }
	});

	if (!res.ok) return mockUniverse;
	return (await res.json()) as UniverseResponse;
}
