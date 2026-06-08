import { useEffect, useState } from "react";

/**
 * Returns the active masonry column count, matching the board's Tailwind
 * breakpoints (base → 2, sm → 3, lg → 4). Used to distribute items into fixed
 * columns so the layout stays stable as content appends.
 */
export function useColumnCount(): number {
    const [count, setCount] = useState(() => computeColumnCount());

    useEffect(() => {
        const sm = window.matchMedia("(min-width: 640px)");
        const lg = window.matchMedia("(min-width: 1024px)");
        const update = () => setCount(computeColumnCount());

        sm.addEventListener("change", update);
        lg.addEventListener("change", update);
        update();

        return () => {
            sm.removeEventListener("change", update);
            lg.removeEventListener("change", update);
        };
    }, []);

    return count;
}

function computeColumnCount(): number {
    if (typeof window === "undefined") {
        return 2;
    }
    if (window.matchMedia("(min-width: 1024px)").matches) {
        return 4;
    }
    if (window.matchMedia("(min-width: 640px)").matches) {
        return 3;
    }
    return 2;
}
