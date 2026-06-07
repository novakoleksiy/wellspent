import { Link } from "react-router-dom";
import { BOARD_META, type BoardItem } from "../boardItems";

type BoardCardProps = {
    item: BoardItem;
};

/** A single image-forward masonry tile, colour-coded by content type. */
export default function BoardCard({ item }: BoardCardProps) {
    const meta = BOARD_META[item.kind];

    const inner = (
        <>
            {item.imageUrl ? (
                <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="w-full h-auto object-cover transition duration-300 group-hover:scale-[1.03]"
                    loading="lazy"
                />
            ) : (
                <div className={`h-44 ${meta.tintClass}`} />
            )}

            <span
                className={`absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-semibold shadow-sm ${meta.badgeClass}`}
            >
                {meta.label}
            </span>

            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[rgba(20,19,15,0.82)] via-[rgba(20,19,15,0.35)] to-transparent px-4 pb-4 pt-12">
                <p className="line-clamp-2 text-base font-semibold tracking-[-0.02em] text-white">
                    {item.title}
                </p>
                {item.subtitle && (
                    <p className="mt-1 line-clamp-1 text-xs font-medium text-white/80">
                        {item.subtitle}
                    </p>
                )}
            </div>
        </>
    );

    const className =
        "group relative block w-full overflow-hidden rounded-[1.5rem] border border-[var(--ws-line)] bg-[#fffdf8] text-left transition hover:border-[rgba(20,19,15,0.24)]";

    if (item.to) {
        return (
            <Link to={item.to} className={className}>
                {inner}
            </Link>
        );
    }

    return (
        <button type="button" onClick={item.onSelect} className={className}>
            {inner}
        </button>
    );
}
