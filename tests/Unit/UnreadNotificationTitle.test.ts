import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { trackUnreadNotificationTitle } from '../../resources/js/hooks/use-unread-notification-title.ts';

let title = 'Latest - /dev/null';
const observers = new Set<TestMutationObserver>();
const cleanups: Array<() => void> = [];
let documentDescriptor: PropertyDescriptor | undefined;
let observerDescriptor: PropertyDescriptor | undefined;

class TestMutationObserver {
    private readonly callback: MutationCallback;

    constructor(callback: MutationCallback) {
        this.callback = callback;
    }

    observe(): void {
        observers.add(this);
    }

    disconnect(): void {
        observers.delete(this);
    }

    notify(): void {
        this.callback([], this as unknown as MutationObserver);
    }
}

function track(count: number): void {
    cleanups.push(trackUnreadNotificationTitle(count));
}

beforeEach(() => {
    title = 'Latest - /dev/null';
    documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
    observerDescriptor = Object.getOwnPropertyDescriptor(
        globalThis,
        'MutationObserver',
    );

    Object.defineProperty(globalThis, 'document', {
        configurable: true,
        value: {
            head: {},
            get title() {
                return title;
            },
            set title(value: string) {
                title = value;
                observers.forEach((observer) => observer.notify());
            },
        },
    });
    Object.defineProperty(globalThis, 'MutationObserver', {
        configurable: true,
        value: TestMutationObserver,
    });
});

afterEach(() => {
    cleanups.splice(0).forEach((cleanup) => cleanup());
    observers.clear();

    if (documentDescriptor) {
        Object.defineProperty(globalThis, 'document', documentDescriptor);
    } else {
        Reflect.deleteProperty(globalThis, 'document');
    }

    if (observerDescriptor) {
        Object.defineProperty(
            globalThis,
            'MutationObserver',
            observerDescriptor,
        );
    } else {
        Reflect.deleteProperty(globalThis, 'MutationObserver');
    }
});

void test('shows the unread count before the current page title', () => {
    track(3);

    assert.equal(document.title, '(3) Latest - /dev/null');
});

void test('keeps the count when Inertia changes the title', () => {
    track(3);
    document.title = 'A developer (@dev) - /dev/null';

    assert.equal(document.title, '(3) A developer (@dev) - /dev/null');
});

void test('updates the count without stacking prefixes', () => {
    track(3);
    cleanups.splice(0).forEach((cleanup) => cleanup());
    track(5);

    assert.equal(document.title, '(5) Latest - /dev/null');
});

void test('restores the normal page title once notifications are read', () => {
    track(3);
    cleanups.splice(0).forEach((cleanup) => cleanup());
    track(0);

    assert.equal(document.title, 'Latest - /dev/null');
    assert.equal(observers.size, 0);
});

void test('leaves titles starting with a number in parentheses intact', () => {
    title = '(10) things I learned - /dev/null';
    track(3);

    assert.equal(document.title, '(3) (10) things I learned - /dev/null');
    cleanups.splice(0).forEach((cleanup) => cleanup());
    assert.equal(document.title, '(10) things I learned - /dev/null');
});

void test('stops updating the title after unmounting', () => {
    track(2);
    cleanups.splice(0).forEach((cleanup) => cleanup());
    document.title = 'Another page - /dev/null';

    assert.equal(document.title, 'Another page - /dev/null');
    assert.equal(observers.size, 0);
});
