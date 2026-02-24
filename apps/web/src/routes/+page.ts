import type { PageLoad } from './$types';

type TabKey = 'left' | 'center' | 'right';

const normalizeTab = (value: string | null): TabKey => {
	if (value === 'left' || value === 'center' || value === 'right') return value;
	return 'center';
};

const normalizeSymbol = (value: string | null): string | null => {
	if (!value) return null;
	const next = value.trim();
	return next ? next : null;
};

const normalizeBoard = (value: string | null): string | null => {
	if (!value) return null;
	const next = value.trim();
	return next ? next : null;
};

export const prerender = false;
export const csr = true;

export const load: PageLoad = ({ url }) => {
	return {
		initialTab: normalizeTab(url.searchParams.get('tab')),
		initialSymbol: normalizeSymbol(url.searchParams.get('symbol')),
		initialBoard: normalizeBoard(url.searchParams.get('board'))
	};
};
