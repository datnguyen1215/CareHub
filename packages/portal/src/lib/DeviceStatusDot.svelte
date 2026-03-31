<script lang="ts">
	interface Props {
		status: 'online' | 'offline';
		size?: 'sm' | 'md';
	}

	let { status, size = 'md' }: Props = $props();

	const sizeClasses = {
		sm: 'w-2 h-2',
		md: 'w-2.5 h-2.5'
	};
</script>

<span
	class="inline-block rounded-full {sizeClasses[size]} {status === 'online'
		? 'bg-green-500'
		: 'bg-gray-400'}"
	aria-label={status === 'online' ? 'Online' : 'Offline'}
></span>
