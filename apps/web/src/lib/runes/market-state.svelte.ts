import type { BoardItem, WatchItem } from '$lib/api/types';

export const marketState = $state({
	activeBoardCode: '',
	activeSymbol: '',
	boards: [] as BoardItem[],
	watchlist: [] as WatchItem[]
});

export function getTopBoardName() {
	return marketState.boards.find((b) => b.code === marketState.activeBoardCode)?.name ?? '';
}
