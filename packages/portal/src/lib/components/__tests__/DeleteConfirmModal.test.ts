import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import DeleteConfirmModal from '$lib/DeleteConfirmModal.svelte';

describe('DeleteConfirmModal', () => {
	const defaultProps = {
		name: 'John Doe',
		onConfirm: vi.fn().mockResolvedValue(undefined),
		onClose: vi.fn()
	};

	it('renders the profile name in the confirmation message', () => {
		render(DeleteConfirmModal, { ...defaultProps });
		expect(screen.getByText(/John Doe/)).toBeInTheDocument();
	});

	it('renders "Remove profile" heading', () => {
		render(DeleteConfirmModal, { ...defaultProps });
		expect(screen.getByText('Remove profile')).toBeInTheDocument();
	});

	it('renders Cancel and Delete buttons', () => {
		render(DeleteConfirmModal, { ...defaultProps });
		expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
	});

	it('calls onClose when Cancel button is clicked', async () => {
		render(DeleteConfirmModal, { ...defaultProps });
		await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
		expect(defaultProps.onClose).toHaveBeenCalledOnce();
	});

	it('calls onConfirm when Delete button is clicked', async () => {
		const onConfirm = vi.fn().mockResolvedValue(undefined);
		render(DeleteConfirmModal, { ...defaultProps, onConfirm });
		await fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
		expect(onConfirm).toHaveBeenCalledOnce();
	});

	it('shows "Deleting…" while confirm is in progress', async () => {
		let resolveConfirm!: () => void;
		const onConfirm = vi.fn().mockImplementation(
			() => new Promise<void>((resolve) => { resolveConfirm = resolve; })
		);
		render(DeleteConfirmModal, { ...defaultProps, onConfirm });
		await fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
		expect(screen.getByText('Deleting…')).toBeInTheDocument();
		resolveConfirm();
	});

	it('disables buttons while loading', async () => {
		let resolveConfirm!: () => void;
		const onConfirm = vi.fn().mockImplementation(
			() => new Promise<void>((resolve) => { resolveConfirm = resolve; })
		);
		render(DeleteConfirmModal, { ...defaultProps, onConfirm });
		await fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
		expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
		resolveConfirm();
	});

	it('shows error message when onConfirm rejects', async () => {
		const onConfirm = vi.fn().mockRejectedValue(new Error('Delete failed'));
		render(DeleteConfirmModal, { ...defaultProps, onConfirm });
		await fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
		// Wait for async handler to settle
		await vi.waitFor(() => {
			expect(screen.getByRole('alert')).toHaveTextContent('Delete failed');
		});
	});

	it('shows fallback error when onConfirm rejects without message', async () => {
		const onConfirm = vi.fn().mockRejectedValue({ code: 'UNKNOWN' });
		render(DeleteConfirmModal, { ...defaultProps, onConfirm });
		await fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
		await vi.waitFor(() => {
			expect(screen.getByRole('alert')).toHaveTextContent('Failed to delete profile');
		});
	});

	it('calls onClose when backdrop is clicked', async () => {
		render(DeleteConfirmModal, { ...defaultProps });
		const backdrop = screen.getByRole('dialog');
		await fireEvent.click(backdrop);
		expect(defaultProps.onClose).toHaveBeenCalledOnce();
	});
});
