/**
 * Focus trap utility for modal accessibility
 * Manages focus trapping and restoration for modal dialogs
 */

const FOCUSABLE_SELECTOR =
	'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Creates a focus trap for a modal element
 * @param modalElement - The modal container element
 * @param onClose - Callback to close the modal (for ESC key)
 * @returns Cleanup function to restore focus and remove event listeners
 */
export function createFocusTrap(modalElement: HTMLElement, onClose: () => void): () => void {
	// Store the previously focused element to restore focus on close
	const previouslyFocused = document.activeElement as HTMLElement;

	// Get all focusable elements within the modal
	function getFocusableElements(): HTMLElement[] {
		return Array.from(modalElement.querySelectorAll(FOCUSABLE_SELECTOR));
	}

	// Handle keyboard events
	function handleKeydown(e: KeyboardEvent) {
		// ESC key closes the modal
		if (e.key === 'Escape') {
			e.preventDefault();
			onClose();
			return;
		}

		// Tab key for focus trapping
		if (e.key === 'Tab') {
			const focusableElements = getFocusableElements();
			if (focusableElements.length === 0) return;

			const firstElement = focusableElements[0];
			const lastElement = focusableElements[focusableElements.length - 1];

			// Shift+Tab on first element: wrap to last
			if (e.shiftKey && document.activeElement === firstElement) {
				e.preventDefault();
				lastElement.focus();
			}
			// Tab on last element: wrap to first
			else if (!e.shiftKey && document.activeElement === lastElement) {
				e.preventDefault();
				firstElement.focus();
			}
		}
	}

	// Set up the focus trap
	modalElement.addEventListener('keydown', handleKeydown);

	// Auto-focus the first input field or focusable element
	requestAnimationFrame(() => {
		const focusableElements = getFocusableElements();
		if (focusableElements.length > 0) {
			// Prefer first input element, otherwise first focusable element
			const firstInput = focusableElements.find(
				(el) => el.tagName === 'INPUT' || el.tagName === 'TEXTAREA'
			);
			const elementToFocus = firstInput || focusableElements[0];
			elementToFocus.focus();
		}
	});

	// Return cleanup function
	return () => {
		modalElement.removeEventListener('keydown', handleKeydown);
		// Restore focus to the previously focused element
		if (previouslyFocused && previouslyFocused.focus) {
			previouslyFocused.focus();
		}
	};
}
