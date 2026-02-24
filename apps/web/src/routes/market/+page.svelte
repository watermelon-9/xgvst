<script lang="ts">
	import { onMount } from 'svelte';
	import { fetchUniverse } from '$lib/api';
	import { mockUniverse } from '$lib/api/mock';
	import { marketState, getTopBoardName } from '$lib/runes/market-state.svelte';
	import { quoteStore, mountQuoteStore, setQuoteSubscriptionScope } from '$lib/runes/quote-store.svelte';
	import { useAuth } from '$lib/auth/useAuth.svelte';

	const tickRenderChain =
		'WS frame(binary/protobuf) → useQuoteWebSocket.resync(当前个股+自选) → quoteStore → 页面渲染';
	const auth = useAuth();

	let loginUserId = $state('');
	let authPullReady = $state(false);
	let mergeEvidence = $state({
		lastMergedAt: null as string | null,
		addedSymbols: [] as string[]
	});

	async function pullAndMergeWatchlist() {
		if (!auth.isAuthenticated()) {
			authPullReady = true;
			return;
		}
		if (!marketState.watchlist.length) return;

		const merged = await auth.mergeWatchlist(marketState.watchlist);
		if (merged.addedSymbols.length > 0) {
			marketState.watchlist = merged.watchlist;
			if (!marketState.activeSymbol) {
				marketState.activeSymbol = merged.watchlist[0]?.symbol ?? '';
			}
		}

		if (merged.addedSymbols.length > 0 || !mergeEvidence.lastMergedAt) {
			mergeEvidence.lastMergedAt = new Date().toISOString();
			mergeEvidence.addedSymbols = merged.addedSymbols;
		}
		authPullReady = true;
	}

	function handleSignIn() {
		const userId = loginUserId.trim();
		if (!userId) return;
		authPullReady = false;
		auth.signIn(userId);
	}

	function handleSignOut() {
		auth.signOut();
		authPullReady = true;
		mergeEvidence.lastMergedAt = null;
		mergeEvidence.addedSymbols = [];
	}

	onMount(() => {
		auth.bootstrap();
		loginUserId = auth.state.user?.id ?? '';
		authPullReady = auth.state.status !== 'authenticated';

		let disposed = false;
		let unmountQuoteStore: () => void = () => {};

		const startRealtimePipeline = async () => {
			if (disposed) return;

			unmountQuoteStore = mountQuoteStore();
			const data = await fetchUniverse().catch(() => mockUniverse);
			if (disposed) return;

			marketState.boards = data.boards;
			marketState.watchlist = data.watchlist;
			marketState.activeBoardCode = data.boards[0]?.code ?? '';
			marketState.activeSymbol = data.watchlist[0]?.symbol ?? '';
		};

		const idleHandle =
			typeof window.requestIdleCallback === 'function'
				? window.requestIdleCallback(() => {
					void startRealtimePipeline();
				})
				: window.setTimeout(() => {
					void startRealtimePipeline();
				}, 120);

		return () => {
			disposed = true;
			if (typeof window.cancelIdleCallback === 'function') {
				window.cancelIdleCallback(idleHandle);
			} else {
				window.clearTimeout(idleHandle);
			}
			unmountQuoteStore();
		};
	});

	$effect(() => {
		if (auth.state.status !== 'authenticated') {
			authPullReady = true;
			return;
		}
		if (!marketState.watchlist.length) return;
		void pullAndMergeWatchlist();
	});

	$effect(() => {
		const watchlistSymbols = marketState.watchlist.map((item) => item.symbol);
		setQuoteSubscriptionScope({
			activeSymbol: marketState.activeSymbol,
			watchlistSymbols
		});
	});

	$effect(() => {
		const watchlistSymbols = marketState.watchlist.map((item) => item.symbol);
		if (!watchlistSymbols.length) return;
		if (auth.state.status === 'authenticated' && !authPullReady) return;
		void auth.syncWatchlist(watchlistSymbols);
	});
</script>

<main class="page">
	<div class="container">
		<header class="topbar">
			<h1 class="title">市场总览</h1>
			<a href="/" class="back-link">返回首页</a>
		</header>

		<section class="panel panel-spaced">
			<h2>Auth 状态流（P2.4 R2 证据）</h2>
			<div class="list">
				<div class="row-link">
					<div class="row-between">
						<div>当前状态</div>
						<div class="muted">{auth.state.status}</div>
					</div>
				</div>
				<div class="row-link">
					<div class="row-between">
						<div>当前用户</div>
						<div class="muted">{auth.state.user?.id ?? '--'}（{auth.state.user?.source ?? '--'}）</div>
					</div>
				</div>
				<div class="row-link">
					<div class="row-between">
						<div>最近自动拉取</div>
						<div class="muted">
							{auth.state.lastSelfSelectPullAt ?? '--'}
							{#if auth.state.lastSelfSelectPullSource}
								（{auth.state.lastSelfSelectPullSource}{auth.state.lastSelfSelectPullEndpoint
									? ` @ ${auth.state.lastSelfSelectPullEndpoint}`
									: ''}）
							{/if}
						</div>
					</div>
				</div>
				<div class="row-link">
					<div class="row-between">
						<div>最近自动同步</div>
						<div class="muted">
							{auth.state.lastSelfSelectSyncAt ?? '--'}
							{#if auth.state.lastSelfSelectSyncEndpoint}
								（{auth.state.lastSelfSelectSyncEndpoint}）
							{/if}
						</div>
					</div>
				</div>
				<div class="row-link">
					<div class="row-between">
						<div>合并结果（新增 symbols）</div>
						<div class="muted">
							{mergeEvidence.addedSymbols.length > 0 ? mergeEvidence.addedSymbols.join(', ') : 'none'}
						</div>
					</div>
				</div>
				{#if auth.state.lastSelfSelectPullError || auth.state.lastSelfSelectSyncError}
					<div class="row-link">
						<div class="muted">
							pullError: {auth.state.lastSelfSelectPullError ?? '--'} ｜ syncError:
							{auth.state.lastSelfSelectSyncError ?? '--'}
						</div>
					</div>
				{/if}
			</div>

			<div class="list card-grid-spaced">
				<label class="muted" for="auth-user-id">模拟登录 userId（本地演示）</label>
				<input id="auth-user-id" bind:value={loginUserId} placeholder="例如：demo-user-a" class="auth-input" />
				<div class="row-between">
					<button type="button" class="row-btn" onclick={handleSignIn}>登录（切换 authenticated）</button>
					<button type="button" class="row-btn" onclick={handleSignOut}>退出（回到 anonymous）</button>
				</div>
			</div>
		</section>

		<section class="panel-grid">
			<div class="panel">
				<h2>版块</h2>
				<div class="list">
					{#each marketState.boards as board}
						<button
							type="button"
							class={`row-btn ${marketState.activeBoardCode === board.code ? 'active' : ''}`}
							onclick={() => (marketState.activeBoardCode = board.code)}
						>
							<div class="row-between">
								<span>{board.name}</span>
								<span class={board.changePct >= 0 ? 'up' : 'down'}>{board.changePct}%</span>
							</div>
						</button>
					{/each}
				</div>
			</div>

			<div class="panel">
				<h2>自选</h2>
				<div class="list">
					{#each marketState.watchlist as item}
						<a
							href={`/detail/${item.symbol}`}
							class="row-link"
							onmouseenter={() => (marketState.activeSymbol = item.symbol)}
						>
							<div class="row-between">
								<div>
									<div>{item.name}</div>
									<div class="muted">{item.symbol}</div>
								</div>
								<div class="align-right">
									<div>{item.last}</div>
									<div class={item.changePct >= 0 ? 'up muted' : 'down muted'}>{item.changePct}%</div>
								</div>
							</div>
						</a>
					{/each}
				</div>
			</div>

			<div class="panel">
				<h2>实时 Tick（WS）</h2>
				<div class="list">
					<div class="row-link">
						<div class="row-between">
							<div>连接状态</div>
							<div class="muted">{quoteStore.socketStats.status}</div>
						</div>
					</div>
					<div class="row-link">
						<div class="row-between">
							<div>恢复补齐状态</div>
							<div class="muted">
								{quoteStore.socketStats.recovering
									? `recovering(${quoteStore.socketStats.pendingRecoverySymbols.join(', ')})`
									: 'ready'}
							</div>
						</div>
					</div>
					<div class="row-link">
						<div class="row-between">
							<div>精准重订阅次数</div>
							<div class="muted">{quoteStore.resubscribeCount}</div>
						</div>
					</div>
					<div class="row-link">
						<div class="row-between">
							<div>当前订阅 symbols</div>
							<div class="muted">{quoteStore.subscribedSymbols.join(', ') || '--'}</div>
						</div>
					</div>
					<div class="row-link">
						<div class="row-between">
							<div>binary frames vs fallback frames</div>
							<div class="muted">
								{quoteStore.socketStats.binaryFrames} vs {quoteStore.socketStats.fallbackFrames}
							</div>
						</div>
					</div>
					<div class="row-link">
						<div class="row-between">
							<div>protobuf decode success</div>
							<div class="muted">{quoteStore.socketStats.protobufDecodeSuccess}</div>
						</div>
					</div>
					{#each quoteStore.subscribedSymbols as symbol}
						<div class="row-link">
							<div class="row-between">
								<div>
									<div>{symbol}</div>
									<div class="muted">
										{quoteStore.latestTickBySymbol[symbol]?.source ?? 'waiting...'}
										{#if quoteStore.latestTickBySymbol[symbol]}
											({quoteStore.latestTickBySymbol[symbol]?.transport})
										{/if}
									</div>
								</div>
								<div class="align-right">
									<div>{quoteStore.latestTickBySymbol[symbol]?.price ?? '--'}</div>
									<div
										class={
											(quoteStore.latestTickBySymbol[symbol]?.changePct ?? 0) >= 0
												? 'up muted'
												: 'down muted'
										}
									>
										{quoteStore.latestTickBySymbol[symbol]?.changePct ?? '--'}
									</div>
								</div>
							</div>
						</div>
					{/each}
				</div>
			</div>
		</section>

		<footer class="footer">
			当前版块：{getTopBoardName() || '未选择'} ｜ 当前个股：{marketState.activeSymbol || '未选择'} ｜
			最新 WS Tick：{quoteStore.latestTick?.symbol ?? '--'} @{quoteStore.latestSource}
			<br />
			链路：{tickRenderChain}
			<br />
			类型校验：{quoteStore.latestTickDataType}（expected: {quoteStore.latestTickTypeExpected}）
			{quoteStore.latestTickTypeConsistent ? '✅' : '❌'}
			<br />
			JSON fallback 开关：{quoteStore.jsonTickFallbackEnabled ? '开启（调试）' : '关闭（默认）'}
			｜ WS URL：{quoteStore.quoteWsUrl}
			<br />
			JSON tick 残留：{quoteStore.tickTransportCounter['ws-json-fallback'] === 0
				? '未检测到'
				: `检测到 ${quoteStore.tickTransportCounter['ws-json-fallback']} 条（仅兼容兜底）`}
		</footer>
	</div>
</main>
