import type { ReactNode } from "react";
import { Link } from "react-router-dom";

type RailProps = {
    eyebrow: string;
    eyebrowClassName?: string;
    title: string;
    seeAllTo?: string;
    seeAllLabel?: string;
    children: ReactNode;
};

/**
 * A titled, horizontally-scrolling row. Children are expected to already carry a
 * fixed width (e.g. `w-72 shrink-0 snap-start`) so existing cards drop in as-is.
 */
export default function Rail({
    eyebrow,
    eyebrowClassName = "text-[var(--ws-orange)]",
    title,
    seeAllTo,
    seeAllLabel = "See all",
    children,
}: RailProps) {
    return (
        <section className="ws-surface p-6 sm:p-7">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <p className={`ws-mono ${eyebrowClassName}`}>{eyebrow}</p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-[var(--ws-ink)]">
                        {title}
                    </h2>
                </div>
                {seeAllTo && (
                    <Link
                        to={seeAllTo}
                        className="shrink-0 text-sm font-medium text-[var(--ws-muted)] transition hover:text-[var(--ws-ink)]"
                    >
                        {seeAllLabel}
                    </Link>
                )}
            </div>

            <div className="ws-rail -mx-6 mt-6 flex gap-4 overflow-x-auto px-6 pb-2 sm:-mx-7 sm:px-7">
                {children}
            </div>
        </section>
    );
}
