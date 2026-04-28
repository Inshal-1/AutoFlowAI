<script lang="ts">
	import { listDevices } from '$lib/api/devices.remote';
	import { dashboardWs } from '$lib/stores/dashboard-ws.svelte';
	import { onMount } from 'svelte';
	import DeviceCard from '$lib/components/DeviceCard.svelte';
	import Icon from '@iconify/svelte';
	import { toast } from '$lib/toast';

	interface DeviceEntry {
		deviceId: string;
		name: string;
		status: 'online' | 'offline';
		model: string | null;
		manufacturer: string | null;
		androidVersion: string | null;
		screenWidth: number | null;
		screenHeight: number | null;
		batteryLevel: number | null;
		isCharging: boolean;
		lastSeen: string;
		lastGoal: { goal: string; status: string; startedAt: string } | null;
	}

	const initialDevices = await listDevices();

	let devices = $state<DeviceEntry[]>(
		initialDevices.map((d) => ({
			deviceId: d.deviceId,
			name: d.name,
			status: d.status as 'online' | 'offline',
			model: d.model as string | null,
			manufacturer: d.manufacturer as string | null,
			androidVersion: d.androidVersion as string | null,
			screenWidth: d.screenWidth as number | null,
			screenHeight: d.screenHeight as number | null,
			batteryLevel: d.batteryLevel as number | null,
			isCharging: d.isCharging as boolean,
			lastSeen: d.lastSeen,
			lastGoal: d.lastGoal as DeviceEntry['lastGoal']
		}))
	);

	onMount(() => {
		const unsub = dashboardWs.subscribe((msg) => {
			if (msg.type === 'device_online') {
				const id = msg.deviceId as string;
				const name = msg.name as string;
				const existing = devices.find((d) => d.deviceId === id);
				if (existing) {
					existing.status = 'online';
					existing.lastSeen = new Date().toISOString();
					devices = [...devices];
				} else {
					devices = [
						{
							deviceId: id,
							name,
							status: 'online',
							model: null,
							manufacturer: null,
							androidVersion: null,
							screenWidth: null,
							screenHeight: null,
							batteryLevel: null,
							isCharging: false,
							lastSeen: new Date().toISOString(),
							lastGoal: null
						},
						...devices
					];
				}
				toast.success(`${name} connected`);
			} else if (msg.type === 'device_offline') {
				const id = msg.deviceId as string;
				const existing = devices.find((d) => d.deviceId === id);
				if (existing) {
					existing.status = 'offline';
					devices = [...devices];
					toast.info(`${existing.name} disconnected`);
				}
			} else if (msg.type === 'device_status') {
				const id = msg.deviceId as string;
				const existing = devices.find((d) => d.deviceId === id);
				if (existing) {
					existing.batteryLevel = msg.batteryLevel as number;
					existing.isCharging = msg.isCharging as boolean;
					devices = [...devices];
				}
			}
		});
		return unsub;
	});
</script>

<h2 class="mb-6 text-2xl font-bold">Devices</h2>

{#if devices.length === 0}
	<div class="rounded-xl border border-neutral-200 p-10 text-center">
		<div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-100">
			<Icon icon="ph:device-mobile-slash-duotone" class="h-6 w-6 text-neutral-400" />
		</div>
		<p class="font-medium text-neutral-600">No devices connected</p>
		<p class="mt-1 text-sm text-neutral-400">
			Install the Android app, paste your API key, and your device will appear here.
		</p>
		<div class="mt-4 flex flex-col items-center gap-3">
			<a
				href="https://github.com/p0tfur/AutoFlow/releases/download/v0.3.1/app-debug.apk"
				class="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
			>
				<Icon icon="ph:android-logo-duotone" class="h-4 w-4" />
				Download APK
			</a>
			<a
				href="/dashboard/api-keys"
				class="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-neutral-700"
			>
				<Icon icon="ph:key-duotone" class="h-4 w-4" />
				Create an API key
			</a>
		</div>
	</div>
{:else}
	<div class="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
		{#each devices as d (d.deviceId)}
			<DeviceCard {...d} />
		{/each}
	</div>
{/if}
