import { apiConfig } from '$lib/api/config';
import type { WatchItem } from '$lib/api/types';

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

type PullResult = {
	skipped: boolean;
	ok: boolean;
	source?: 'remote' | 'localStorage';
	endpoint?: string;
	symbols?: string[];
	error?: string;
};

type MergeWatchlistResult = {
	watchlist: WatchItem[];
	addedSymbols: string[];
	pullResult: PullResult;
};

const AUTH_USER_ID_QUERY_KEY = 'authUserId';
const AUTH_USER_ID_STORAGE_KEY = 'xgvst.auth.userId';
const AUTH_SELF_SELECT_STORAGE_PREFIX = 'xgvst.auth.selfSelectSymbols';

const authState = $state({
	status: 'idle' as AuthStatus,
	user: null as AuthUser | null,
	lastSelfSelectSyncAt: null as string | null,
	lastSelfSelectSyncError: null as string | null,
	lastSelfSelectSyncEndpoint: null as string | null,
	lastSelfSelectSyncFingerprint: '',
	lastSelfSelectPullAt: null as string | null,
	lastSelfSelectPullError: null as string | null,
	lastSelfSelectPullEndpoint: null as string | null,
	lastSelfSelectPullSource: null as ('remote' | 'localStorage') | null,
	lastSelfSelectPullFingerprint: ''
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

function localSelfSelectStorageKey(userId: string): string {
	return `${AUTH_SELF_SELECT_STORAGE_PREFIX}.${userId}`;
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

		if (response.status === 404 || response.status === 401) {
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

async function pullSelfSelectFromServer(userId: string): Promise<PullResult> {
	const baseUrl = resolveApiBaseUrl();
	const endpoints = [`${baseUrl}/v2/self-selects`, `${baseUrl}/api/self-selects`];

	for (const endpoint of endpoints) {
		const response = await fetch(endpoint, {
			method: 'GET',
			headers: {
				Accept: 'application/json',
				'x-user-id': userId
			}
		});

		if (response.ok) {
			const payload = (await response.json().catch(() => ({}))) as { symbols?: unknown };
			const raw = Array.isArray(payload.symbols) ? payload.symbols : [];
			const symbols = normalizeSymbols(raw.filter((item): item is string => typeof item === 'string'));
			return { skipped: false, ok: true, source: 'remote', endpoint, symbols };
		}

		if (response.status === 404 || response.status === 401) {
			continue;
		}

		return {
			skipped: false,
			ok: false,
			endpoint,
			error: `pull failed: ${response.status} ${response.statusText}`
		};
	}

	return {
		skipped: false,
		ok: false,
		error: 'pull failed: no available endpoint (/v2/self-selects, /api/self-selects)'
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

function persistSelfSelectSymbols(userId: string, symbols: string[]) {
	if (!isBrowser()) return;
	try {
		window.localStorage.setItem(localSelfSelectStorageKey(userId), JSON.stringify(symbols));
	} catch {
		// noop
	}
}

function readPersistedSelfSelectSymbols(userId: string): string[] {
	if (!isBrowser()) return [];
	try {
		const raw = window.localStorage.getItem(localSelfSelectStorageKey(userId));
		if (!raw) return [];
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return [];
		return normalizeSymbols(parsed.filter((item): item is string => typeof item === 'string'));
	} catch {
		return [];
	}
}

function setAuthenticatedUser(user: AuthUser) {
	authState.status = 'authenticated';
	authState.user = user;
	authState.lastSelfSelectSyncFingerprint = '';
	authState.lastSelfSelectPullFingerprint = '';
}

function markAnonymous() {
	authState.status = 'anonymous';
	authState.user = null;
	authState.lastSelfSelectSyncFingerprint = '';
	authState.lastSelfSelectPullFingerprint = '';
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
		persistSelfSelectSymbols(authState.user.id, normalizedSymbols);

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
		persistSelfSelectSymbols(authState.user.id, normalizedSymbols);
		return { skipped: false, ok: false, error: message };
	}
}

async function pullWatchlistSymbols(): Promise<PullResult> {
	if (authState.status !== 'authenticated' || !authState.user) {
		return { skipped: true, ok: true, symbols: [] };
	}

	const userId = authState.user.id;
	try {
		const remoteResult = await pullSelfSelectFromServer(userId);
		if (!remoteResult.ok) {
			authState.lastSelfSelectPullError = remoteResult.error ?? 'unknown pull error';
			authState.lastSelfSelectPullEndpoint = remoteResult.endpoint ?? null;
			return remoteResult;
		}

		const symbols = normalizeSymbols(remoteResult.symbols ?? []);
		persistSelfSelectSymbols(userId, symbols);
		authState.lastSelfSelectPullAt = new Date().toISOString();
		authState.lastSelfSelectPullSource = 'remote';
		authState.lastSelfSelectPullError = null;
		authState.lastSelfSelectPullEndpoint = remoteResult.endpoint ?? null;
		authState.lastSelfSelectPullFingerprint = buildFingerprint(userId, symbols);
		return { ...remoteResult, symbols };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		const symbols = readPersistedSelfSelectSymbols(userId);
		authState.lastSelfSelectPullAt = new Date().toISOString();
		authState.lastSelfSelectPullSource = 'localStorage';
		authState.lastSelfSelectPullError = `${message} (fallback localStorage)`;
		authState.lastSelfSelectPullEndpoint = null;
		authState.lastSelfSelectPullFingerprint = buildFingerprint(userId, symbols);
		return { skipped: false, ok: true, source: 'localStorage', symbols };
	}
}

async function mergeWatchlist(localWatchlist: WatchItem[]): Promise<MergeWatchlistResult> {
	const pullResult = await pullWatchlistSymbols();
	const remoteSymbols = normalizeSymbols(pullResult.symbols ?? []);
	if (!remoteSymbols.length) {
		return {
			watchlist: [...localWatchlist],
			addedSymbols: [],
			pullResult
		};
	}

	const existingBySymbol = new Map(localWatchlist.map((item) => [item.symbol, item]));
	const merged: WatchItem[] = [...localWatchlist];
	const addedSymbols: string[] = [];

	for (const symbol of remoteSymbols) {
		if (existingBySymbol.has(symbol)) continue;
		addedSymbols.push(symbol);
		merged.push({
			symbol,
			name: `自选 ${symbol}`,
			last: 0,
			changePct: 0
		});
	}

	return {
		watchlist: merged,
		addedSymbols,
		pullResult
	};
}

export function useAuth() {
	return {
		state: authState,
		bootstrap,
		signIn,
		signOut,
		syncWatchlist,
		pullWatchlistSymbols,
		mergeWatchlist,
		isAuthenticated: () => authState.status === 'authenticated',
		userId: () => authState.user?.id ?? null
	};
}
