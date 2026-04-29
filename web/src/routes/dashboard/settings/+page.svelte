<script lang="ts">
	import { getConfig, updateConfig } from '$lib/api/settings.remote';
	import { page } from '$app/state';
	import Icon from '@iconify/svelte';
	import { toast } from '$lib/toast';
	import { track } from '$lib/analytics/track';
	import { SETTINGS_SAVE } from '$lib/analytics/events';

	const config = await getConfig();
	const layoutData = page.data;

	// Manage keys as a list
	let keyList = $state(config?.apiKey ? config.apiKey.split(';').map(k => k.trim()) : ['']);

	function addKey() {
		keyList = [...keyList, ''];
	}

	function removeKey(index: number) {
		if (keyList.length > 1) {
			keyList = keyList.filter((_, i) => i !== index);
		} else {
			keyList[0] = '';
		}
	}

	// Update the hidden form field whenever keyList changes
	$effect(() => {
		const combined = keyList.filter(k => k.trim()).join(';');
		updateConfig.fields.apiKey.value = combined;
	});

	$effect(() => {
		if (updateConfig.result?.saved) {
			toast.success('Settings saved');
			track(SETTINGS_SAVE);
			// Refresh local config display
			window.location.reload();
		}
	});
</script>

<h2 class="mb-6 text-2xl font-bold">Settings</h2>

<div class="mb-6 max-w-lg rounded-xl border border-neutral-200 p-6">
	<div class="mb-4 flex items-center gap-2">
		<Icon icon="ph:user-duotone" class="h-5 w-5 text-neutral-500" />
		<h3 class="font-semibold">Account</h3>
	</div>
	<div class="space-y-3">
		<div class="flex items-center justify-between">
			<span class="text-sm text-neutral-500">Email</span>
			<span class="text-sm font-medium text-neutral-900 blur-sm transition-all duration-200 hover:blur-none">{layoutData.user.email}</span>
		</div>
		{#if layoutData.plan}
			<div class="flex items-center justify-between">
				<span class="text-sm text-neutral-500">Plan</span>
				<span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
					<Icon icon="ph:seal-check-duotone" class="h-3.5 w-3.5" />
					{layoutData.plan === 'ltd' ? 'Lifetime' : layoutData.plan}
				</span>
			</div>
		{/if}
		{#if layoutData.licenseKey}
			<div class="flex items-center justify-between">
				<span class="text-sm text-neutral-500">License</span>
				<span class="font-mono text-sm text-neutral-600">{layoutData.licenseKey}</span>
			</div>
		{/if}
	</div>
</div>

<div class="max-w-lg rounded-xl border border-neutral-200 p-6">
	<div class="mb-4 flex items-center gap-2">
		<Icon icon="ph:brain-duotone" class="h-5 w-5 text-neutral-500" />
		<h3 class="font-semibold">LLM Provider</h3>
	</div>

	<form {...updateConfig} class="space-y-6">
		<label class="block">
			<span class="flex items-center gap-1.5 text-sm text-neutral-600">
				<Icon icon="ph:plugs-connected-duotone" class="h-4 w-4 text-neutral-400" />
				Provider
			</span>
			<select
				{...updateConfig.fields.provider.as('text')}
				class="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
			>
				<option value="openai">OpenAI</option>
				<option value="groq">Groq</option>
				<option value="gemini">Google Gemini</option>
				<option value="ollama">Ollama (Local)</option>
				<option value="bedrock">AWS Bedrock</option>
				<option value="openrouter">OpenRouter</option>
			</select>
			{#each updateConfig.fields.provider.issues() ?? [] as issue (issue.message)}
				<p class="text-sm text-red-600">{issue.message}</p>
			{/each}
		</label>

		<div>
			<span class="flex items-center gap-1.5 text-sm text-neutral-600">
				<Icon icon="ph:lock-key-duotone" class="h-4 w-4 text-neutral-400" />
				API Keys
			</span>
			
			<!-- Hidden input to carry the aggregated value into the form submission -->
			<input type="hidden" name="apiKey" value={keyList.filter(k => k.trim()).join(';')} />

			<div class="mt-2 space-y-3">
				{#each keyList as _, i}
					<div class="flex gap-2">
						<input
							type="password"
							bind:value={keyList[i]}
							placeholder="Enter API key"
							class="block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
						/>
						<button
							type="button"
							onclick={() => removeKey(i)}
							class="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 text-neutral-400 hover:bg-red-50 hover:text-red-500"
							title="Remove key"
						>
							<Icon icon="ph:trash-duotone" class="h-4 w-4" />
						</button>
					</div>
				{/each}
			</div>
			
			<button
				type="button"
				onclick={addKey}
				class="mt-3 flex items-center gap-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900"
			>
				<Icon icon="ph:plus-circle-duotone" class="h-4 w-4" />
				Add another key
			</button>

			<p class="mt-3 text-xs text-neutral-500">
				<span class="font-semibold text-emerald-600">Load Balanced:</span> AutoFlow will cycle through your keys for every request to maximize your RPM limits.
			</p>

			{#if updateConfig.fields.provider.value === 'bedrock'}
				<div class="mt-3 rounded-lg bg-blue-50 p-3 text-xs text-blue-800">
					<p class="font-bold">Bedrock Format:</p>
					<p class="mt-1">Use <code class="font-mono bg-blue-100 px-1">ACCESS_KEY:SECRET_KEY:REGION</code></p>
					<p class="mt-1 opacity-70">Example: <code class="font-mono">AKIA...:SECRET...:us-east-1</code></p>
				</div>
			{/if}

			{#each updateConfig.fields.apiKey.issues() ?? [] as issue (issue.message)}
				<p class="mt-2 text-sm text-red-600">{issue.message}</p>
			{/each}
		</div>

		<label class="block">
			<span class="flex items-center gap-1.5 text-sm text-neutral-600">
				<Icon icon="ph:cube-duotone" class="h-4 w-4 text-neutral-400" />
				Model (optional)
			</span>
			<input
				{...updateConfig.fields.model.as('text')}
				placeholder="e.g., gpt-4o, llama-3.3-70b-versatile"
				class="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
			/>
		</label>

		<button
			type="submit"
			class="flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2"
		>
			<Icon icon="ph:floppy-disk-duotone" class="h-4 w-4" />
			Save All Settings
		</button>
	</form>

	{#if config}
		<div class="mt-6 flex items-center gap-2 rounded-lg bg-neutral-50 px-3 py-2.5 text-xs text-neutral-500">
			<Icon icon="ph:info-duotone" class="h-4 w-4 shrink-0 text-neutral-400" />
			<div class="overflow-hidden truncate">
				Current: <span class="font-medium text-neutral-700 uppercase">{config.provider}</span>
				&middot; Keys: <span class="font-medium text-neutral-700">{config.apiKey.split(';').length}</span>
				{#if config.model} &middot; Model: <span class="font-medium text-neutral-700">{config.model}</span>{/if}
			</div>
		</div>
	{/if}
</div>
