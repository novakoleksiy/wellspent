import { Link } from "react-router-dom";
import { BOARD_META, type BoardItem } from "../boardItems";

type FeaturedSpotlightProps = {
    item: BoardItem;
};

/** Large "Featured this week" hero for the homepage. */
export default function FeaturedSpotlight({ item }: FeaturedSpotlightProps) {
    const meta = BOARD_META[item.kind];

    const content = (
        <>
            {item.imageUrl ? (
                <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                    loading="lazy"
                />
            ) : (
                <div className="absolute inset-0" style={{ background: meta.accent }} />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[rgba(20,19,15,0.9)] via-[rgba(20,19,15,0.4)] to-[rgba(20,19,15,0.1)]" />

            <div className="relative flex h-full flex-col justify-end p-6 sm:p-8">
                <div className="flex items-center gap-2">
                    <span className="ws-mono text-white/85">★ Featured this week</span>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${meta.badgeClass}`}>
                        {meta.label}
                    </span>
                </div>
                <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl">
                    {item.title}
                </h2>
                {item.subtitle && (
                    <p className="mt-2 text-sm font-medium text-white/85">{item.subtitle}</p>
                )}
                <span className="ws-btn-accent mt-5 w-fit px-5 py-2 text-sm">
                    View {meta.label.toLowerCase()}
                </span>
            </div>
        </>
    );

    const className =
        "group relative block h-72 w-full overflow-hidden rounded-[1.75rem] border border-[var(--ws-line)] shadow-xl shadow-stone-900/10 sm:h-96";

    if (item.to) {
        return (
            <Link to={item.to} className={className}>
                {content}
            </Link>
        );
    }

    return (
        <button type="button" onClick={item.onSelect} className={`${className} text-left`}>
            {content}
        </button>
    );
}
