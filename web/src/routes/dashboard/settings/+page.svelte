<script lang="ts">
	import { getConfig, getModelStatuses, updateConfig, validateLlmConfig, GEMINI_MODELS } from '$lib/api/settings.remote';
	import { page } from '$app/state';
	import Icon from '@iconify/svelte';
	import { toast } from '$lib/toast';
	import { track } from '$lib/analytics/track';
	import { SETTINGS_SAVE } from '$lib/analytics/events';

	const config = await getConfig();
	const initialModelStatuses = await getModelStatuses();
	const layoutData = page.data;

	// Manage keys as a list
	let keyList = $state(config?.apiKey ? config.apiKey.split(';').map(k => k.trim()) : ['']);
	let isValidating = $state(false);
	let modelStatuses = $state(initialModelStatuses);

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
			window.location.reload();
		}
	});

	async function runValidation() {
		isValidating = true;
		try {
			toast.info('Starting validation of all keys and models...');
			await validateLlmConfig();
			const updated = await getModelStatuses();
			modelStatuses = updated;
			toast.success('Validation complete. Availability map updated.');
		} catch (e: any) {
			toast.error('Validation failed: ' + e.message);
		} finally {
			isValidating = false;
		}
	}

	// Helper to find status for a key + model
	function getStatus(key: string, model: string) {
		// Use simple substring for key since we don't have the hash client-side easily 
		// (though we could generate it, let's just match on prefix if we had it, 
		// but the DB has keyHash. Let's just return a placeholder or match if we can).
		// Better: the validate API returns results, we can just use those for live feedback.
		return modelStatuses.find(s => s.modelId === model);
	}
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
	</div>
</div>

<div class="mb-6 max-w-2xl rounded-xl border border-neutral-200 p-6">
	<div class="mb-4 flex items-center gap-2">
		<Icon icon="ph:brain-duotone" class="h-5 w-5 text-neutral-500" />
		<h3 class="font-semibold">LLM Provider & Model Failover</h3>
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
		</label>

		<div>
			<span class="flex items-center gap-1.5 text-sm text-neutral-600">
				<Icon icon="ph:lock-key-duotone" class="h-4 w-4 text-neutral-400" />
				API Keys
			</span>
			
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
		</div>

		<label class="block">
			<span class="flex items-center gap-1.5 text-sm text-neutral-600">
				<Icon icon="ph:cube-duotone" class="h-4 w-4 text-neutral-400" />
				Default Model (Optional)
			</span>
			<input
				{...updateConfig.fields.model.as('text')}
				placeholder="e.g., gemini-2.0-flash"
				class="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
			/>
		</label>

		<div class="flex gap-3">
			<button
				type="submit"
				class="flex flex-1 items-center justify-center gap-2 rounded-lg bg-neutral-900 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800"
			>
				<Icon icon="ph:floppy-disk-duotone" class="h-4 w-4" />
				Save Settings
			</button>
			
			<button
				type="button"
				onclick={runValidation}
				disabled={isValidating || !config}
				class="flex items-center justify-center gap-2 rounded-lg border border-neutral-200 px-4 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
			>
				{#if isValidating}
					<Icon icon="ph:circle-notch-duotone" class="h-4 w-4 animate-spin" />
					Validating...
				{:else}
					<Icon icon="ph:shield-check-duotone" class="h-4 w-4" />
					Validate Keys & Models
				{/if}
			</button>
		</div>
	</form>

	{#if modelStatuses.length > 0}
		<div class="mt-8 border-t border-neutral-100 pt-6">
			<h4 class="mb-4 text-sm font-bold text-neutral-700">Model Availability Map</h4>
			<div class="overflow-hidden rounded-xl border border-neutral-200 text-xs">
				<table class="w-full">
					<thead class="bg-neutral-50">
						<tr>
							<th class="px-4 py-2 text-left">Model</th>
							<th class="px-4 py-2 text-center">Status</th>
							<th class="px-4 py-2 text-right">Last Check</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-neutral-100">
						{#each GEMINI_MODELS as model}
							{@const status = modelStatuses.filter(s => s.modelId === model)}
							{@const availableCount = status.filter(s => s.isAvailable).length}
							<tr>
								<td class="px-4 py-2 font-mono">{model}</td>
								<td class="px-4 py-2 text-center">
									{#if status.length > 0}
										<span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold {availableCount > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}">
											{availableCount}/{status.length} Keys
										</span>
									{:else}
										<span class="text-neutral-400">Untested</span>
									{/if}
								</td>
								<td class="px-4 py-2 text-right text-neutral-400">
									{status[0] ? new Date(status[0].updatedAt).toLocaleDateString() : 'Never'}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<p class="mt-3 text-[11px] text-neutral-500 italic">
				* AutoFlow will automatically skip any model/key combination marked as unavailable.
			</p>
		</div>
	{/if}
</div>
