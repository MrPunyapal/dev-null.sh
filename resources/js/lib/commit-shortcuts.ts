/**
 * Finds the active reply or commit's keyboard action. Only reply falls back to the
 * main commit on a detail page when keyboard focus is elsewhere.
 */
export function commitActionForShortcut(
    key: string,
    activeTarget: Element | null,
    pageCommit: Element | null,
): HTMLButtonElement | null {
    const action = (
        activeTarget ?? (key === 'r' ? pageCommit : null)
    )?.querySelector<HTMLButtonElement>(
        `button[aria-keyshortcuts="${CSS.escape(key)}"]`,
    );

    return action && !action.closest('[inert]') ? action : null;
}
