import { useEffect } from 'react';

/**
 * Keep the unread count in the browser tab when Inertia changes the page title.
 */
export function useUnreadNotificationTitle(count: number): void {
    useEffect(() => trackUnreadNotificationTitle(count), [count]);
}

export function trackUnreadNotificationTitle(count: number): () => void {
    if (count <= 0) {
        return () => undefined;
    }

    let baseTitle = document.title;
    let displayedTitle = baseTitle;

    const update = () => {
        if (document.title !== displayedTitle) {
            baseTitle = document.title;
        }

        const nextTitle = `(${count}) ${baseTitle}`;
        displayedTitle = nextTitle;

        if (document.title !== nextTitle) {
            document.title = nextTitle;
        }
    };

    const observer = new MutationObserver(update);
    observer.observe(document.head, {
        childList: true,
        characterData: true,
        subtree: true,
    });
    update();

    return () => {
        observer.disconnect();

        if (document.title === displayedTitle) {
            document.title = baseTitle;
        }
    };
}
