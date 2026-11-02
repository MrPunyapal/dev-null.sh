/**
 * Uses the same pastry artwork as the commit pastéis button.
 * Decorative when shown beside the achievement name.
 */
export function PastelIcon({ className }: { className?: string }) {
    return (
        <img
            src="/pastel-de-nata.svg"
            alt=""
            aria-hidden
            width={24}
            height={24}
            className={className}
        />
    );
}
