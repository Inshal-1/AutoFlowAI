<script lang="ts">
	import Icon from '@iconify/svelte';

	let { icon, class: className = '' }: { icon: string; class?: string } = $props();
</script>

<Icon {icon} class={className} />
