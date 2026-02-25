<script lang="ts">
	import { onMount } from 'svelte';
	import { fetchUniverse } from '$lib/api';
	import { mockUniverse } from '$lib/api/mock';
	import { marketState, getTopBoardName } from '$lib/runes/market-state.svelte';
	import { quoteStore, mountQuoteStore, setQuoteSubscriptionScope } from '$lib/runes/quote-store.svelte';
	import { useAuth } from '$lib/auth/useAuth.svelte';
	import { useToast } from '$lib/ui/toast.svelte';

	const tickRenderChain =
		'WS frame(binary/protobuf) → useQuoteWebSocket.resync(当前个股+自选) → quoteStore → 页面渲染';
	const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	const LOGIN_FLOW_STORAGE_KEY = 'xgvst.auth.loginFlow';
	const auth = useAuth();
	const toast = useToast();

	let loginUserId = $state('');
	let loginClosure = $state({
		detected: false,
		redirectTo: '--',
		sync: 'unknown' as 'ok' | 'degraded' | 'unknown',
		syncError: null as string | null,
		email: '--',
		at: '--',
		querySync: '--',
		queryFlow: '--'
	});
	let authPullReady = $state(false);
	let mergeEvidence = $state({
		lastMergedAt: null as string | null,
		addedSymbols: [] as string[]
	});

	function resolveLoginClosureEvidence() {
		if (typeof window === 'undefined') return;
		const params = new URLSearchParams(window.location.search);
		const queryFlow = params.get('authFlow') ?? '--';
		const querySync = params.get('sync') ?? '--';
		const queryRedirect = params.get('redirect') ?? '--';
		const queryUid = params.get('uid') ?? '--';

		type LoginFlowPayload = {
			email?: string;
			sync?: 'ok' | 'degraded';
			syncError?: string | null;
			redirectTo?: string;
			at?: string;
		};
		let fromStorage: LoginFlowPayload | null = null;

		try {
			const raw = window.sessionStorage.getItem(LOGIN_FLOW_STORAGE_KEY);
			if (raw) {
				fromStorage = JSON.parse(raw) as LoginFlowPayload;
			}
		} catch {
			fromStorage = null;
		}

		const detected = queryFlow === 'login-success' || Boolean(fromStorage?.email);
		loginClosure.detected = detected;
		loginClosure.redirectTo = fromStorage?.redirectTo ?? queryRedirect;
		loginClosure.sync = fromStorage?.sync ?? (querySync === 'ok' || querySync === 'degraded' ? querySync : 'unknown');
		loginClosure.syncError = fromStorage?.syncError ?? null;
		loginClosure.email = fromStorage?.email ?? queryUid;
		loginClosure.at = fromStorage?.at ?? '--';
		loginClosure.querySync = querySync;
		loginClosure.queryFlow = queryFlow;
	}

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
		const email = loginUserId.trim().toLowerCase();
		if (!email) return;
		if (!EMAIL_PATTERN.test(email)) {
			toast.error('仅支持邮箱账号登录，请输入有效邮箱地址');
			return;
		}
		authPullReady = false;
		auth.signIn(email);
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
		resolveLoginClosureEvidence();

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

		<section
			class="panel panel-spaced"
			data-login-closure-detected={loginClosure.detected ? 'yes' : 'no'}
			data-login-sync-state={loginClosure.sync}
		>
			<h2>登录闭环观测（R1.2.1）</h2>
			<div class="list">
				<div class="row-link">
					<div class="row-between">
						<div>闭环检测</div>
						<div class="muted">{loginClosure.detected ? '已检测' : '未检测'}</div>
					</div>
				</div>
				<div class="row-link">
					<div class="row-between">
						<div>跳转目标</div>
						<div class="muted">{loginClosure.redirectTo}</div>
					</div>
				</div>
				<div class="row-link">
					<div class="row-between">
						<div>同步状态</div>
						<div class="muted">{loginClosure.sync}</div>
					</div>
				</div>
				<div class="row-link">
					<div class="row-between">
						<div>账号（邮箱）</div>
						<div class="muted">{loginClosure.email}</div>
					</div>
				</div>
				<div class="row-link">
					<div class="row-between">
						<div>记录时间</div>
						<div class="muted">{loginClosure.at}</div>
					</div>
				</div>
				{#if loginClosure.syncError}
					<div class="row-link">
						<div class="muted">syncError: {loginClosure.syncError}</div>
					</div>
				{/if}
			</div>
		</section>

		<section class="panel panel-spaced" data-auth-account-system="email-only">
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

			<div class="list card-grid-spaced" data-auth-entry-rule="email-only">
				<label class="muted" for="auth-user-id">模拟登录邮箱账号（仅邮箱体系演示）</label>
				<input
					id="auth-user-id"
					type="email"
					bind:value={loginUserId}
					placeholder="例如：demo@example.com"
					autocomplete="email"
					class="auth-input"
				/>
				<div class="row-between">
					<button type="button" class="row-btn" onclick={handleSignIn}>邮箱登录（authenticated）</button>
					<button type="button" class="row-btn" onclick={handleSignOut}>退出（anonymous）</button>
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
