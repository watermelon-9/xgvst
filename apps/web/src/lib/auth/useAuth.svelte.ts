import { apiConfig } from '$lib/api/config';

type AuthStatus = 'idle' | 'anonymous' | 'authenticated';

type AuthUser = {
	id: string;
	displayName: string;
	source: 'query' | 'localStorage' | 'manual';
};

type SyncResult = {
	skipped: boolean;
	ok: boolean;
	endpoint?: string;
	error?: string;
};

const AUTH_USER_ID_QUERY_KEY = 'authUserId';
const AUTH_USER_ID_STORAGE_KEY = 'xgvst.auth.userId';

const authState = $state({
	status: 'idle' as AuthStatus,
	user: null as AuthUser | null,
	lastSelfSelectSyncAt: null as string | null,
	lastSelfSelectSyncError: null as string | null,
	lastSelfSelectSyncEndpoint: null as string | null,
	lastSelfSelectSyncFingerprint: ''
});

function isBrowser() {
	return typeof window !== 'undefined';
}

function resolveApiBaseUrl(): string {
	const baseUrl = apiConfig.workerApiUrl || apiConfig.legacyApiUrl;
	if (!baseUrl) {
		throw new Error('PUBLIC_WORKER_API_URL / PUBLIC_API_URL is not configured');
	}
	return baseUrl;
}

function normalizeSymbols(symbols: string[]): string[] {
	const set = new Set<string>();
	for (const symbol of symbols) {
		const next = symbol.trim();
		if (!next) continue;
		set.add(next);
	}
	return [...set].sort();
}

function buildFingerprint(userId: string, symbols: string[]): string {
	return `${userId}::${symbols.join(',')}`;
}

async function syncSelfSelectToServer(userId: string, symbols: string[]): Promise<SyncResult> {
	const baseUrl = resolveApiBaseUrl();
	const endpoints = [`${baseUrl}/v2/self-selects`, `${baseUrl}/api/self-selects`];

	for (const endpoint of endpoints) {
		const response = await fetch(endpoint, {
			method: 'PUT',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
				'x-user-id': userId
			},
			body: JSON.stringify({ symbols })
		});

		if (response.ok) {
			return { skipped: false, ok: true, endpoint };
		}

		if (response.status === 404) {
			continue;
		}

		return {
			skipped: false,
			ok: false,
			endpoint,
			error: `sync failed: ${response.status} ${response.statusText}`
		};
	}

	return {
		skipped: false,
		ok: false,
		error: 'sync failed: no available endpoint (/v2/self-selects, /api/self-selects)'
	};
}

function persistUserId(userId: string | null) {
	if (!isBrowser()) return;
	try {
		if (!userId) {
			window.localStorage.removeItem(AUTH_USER_ID_STORAGE_KEY);
			return;
		}
		window.localStorage.setItem(AUTH_USER_ID_STORAGE_KEY, userId);
	} catch {
		// noop
	}
}

function setAuthenticatedUser(user: AuthUser) {
	authState.status = 'authenticated';
	authState.user = user;
}

function markAnonymous() {
	authState.status = 'anonymous';
	authState.user = null;
	authState.lastSelfSelectSyncFingerprint = '';
}

function bootstrap() {
	if (!isBrowser()) {
		if (authState.status === 'idle') {
			markAnonymous();
		}
		return;
	}

	const queryUserId = new URLSearchParams(window.location.search).get(AUTH_USER_ID_QUERY_KEY)?.trim();
	if (queryUserId) {
		setAuthenticatedUser({ id: queryUserId, displayName: queryUserId, source: 'query' });
		persistUserId(queryUserId);
		return;
	}

	const storageUserId = window.localStorage.getItem(AUTH_USER_ID_STORAGE_KEY)?.trim();
	if (storageUserId) {
		setAuthenticatedUser({ id: storageUserId, displayName: storageUserId, source: 'localStorage' });
		return;
	}

	markAnonymous();
}

function signIn(userId: string) {
	const nextUserId = userId.trim();
	if (!nextUserId) return;

	setAuthenticatedUser({ id: nextUserId, displayName: nextUserId, source: 'manual' });
	persistUserId(nextUserId);
}

function signOut() {
	markAnonymous();
	persistUserId(null);
}

async function syncWatchlist(symbols: string[]): Promise<SyncResult> {
	if (authState.status !== 'authenticated' || !authState.user) {
		return { skipped: true, ok: true };
	}

	const normalizedSymbols = normalizeSymbols(symbols);
	const fingerprint = buildFingerprint(authState.user.id, normalizedSymbols);
	if (authState.lastSelfSelectSyncFingerprint === fingerprint) {
		return { skipped: true, ok: true };
	}

	try {
		const result = await syncSelfSelectToServer(authState.user.id, normalizedSymbols);
		if (result.ok) {
			authState.lastSelfSelectSyncFingerprint = fingerprint;
			authState.lastSelfSelectSyncAt = new Date().toISOString();
			authState.lastSelfSelectSyncError = null;
			authState.lastSelfSelectSyncEndpoint = result.endpoint ?? null;
			return result;
		}

		authState.lastSelfSelectSyncError = result.error ?? 'unknown sync error';
		authState.lastSelfSelectSyncEndpoint = result.endpoint ?? null;
		return result;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		authState.lastSelfSelectSyncError = message;
		authState.lastSelfSelectSyncEndpoint = null;
		return { skipped: false, ok: false, error: message };
	}
}

export function useAuth() {
	return {
		state: authState,
		bootstrap,
		signIn,
		signOut,
		syncWatchlist,
		isAuthenticated: () => authState.status === 'authenticated',
		userId: () => authState.user?.id ?? null
	};
}
