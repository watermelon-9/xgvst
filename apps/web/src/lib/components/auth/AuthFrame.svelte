<script lang="ts">
	import type { Snippet } from 'svelte';

	type Tone = 'login' | 'register' | 'forgot';

	let {
		tone,
		sideAriaLabel,
		sideTitle,
		sideDescription,
		sideTags = [],
		headTitle,
		headDescription,
		cardFlow = 'email-password',
		cardAltEntry = 'none',
		headEntryRule = 'email-only',
		headProvider = 'none-phone-wechat-third-party',
		headSentinel = '仅邮箱账号体系，不提供手机号/微信/三方登录。',
		form,
		footer,
		footCentered = false
	}: {
		tone: Tone;
		sideAriaLabel: string;
		sideTitle: string;
		sideDescription: string;
		sideTags?: string[];
		headTitle: string;
		headDescription: string;
		cardFlow?: string;
		cardAltEntry?: string;
		headEntryRule?: string;
		headProvider?: string;
		headSentinel?: string;
		form: Snippet;
		footer: Snippet;
		footCentered?: boolean;
	} = $props();
</script>

<main class={`auth-shell auth-shell-${tone}`}>
	<section
		class={`auth-card auth-card-${tone}`}
		data-auth-flow={cardFlow}
		data-auth-alt-entry={cardAltEntry}
	>
		<aside class={`auth-side auth-side-${tone}`} aria-label={sideAriaLabel}>
			<h1>{sideTitle}</h1>
			<p>{sideDescription}</p>
			<div class="auth-side-tags" aria-hidden="true">
				{#each sideTags as tag}
					<span>{tag}</span>
				{/each}
			</div>
			<p class="auth-login-brand-foot">© Xigua Quant Studio</p>
		</aside>

		<div class="auth-main-panel">
			<header class="auth-head">
				<h1>{headTitle}</h1>
				<p>{headDescription}</p>
				<p class="auth-sentinel" data-auth-entry-rule={headEntryRule} data-auth-provider={headProvider}>
					{headSentinel}
				</p>
			</header>

			{@render form()}

			<footer class={`auth-foot auth-foot-${tone} ${footCentered ? 'auth-foot-center' : ''}`}>
				{@render footer()}
			</footer>
		</div>
	</section>
</main>
