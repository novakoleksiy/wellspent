import { request } from "./client";
import type { DestinationListOut } from "../types";

type ListDestinationsOptions = {
    query?: string;
    language?: string;
    pageSize?: number;
    signal?: AbortSignal;
};

export const listDestinations = ({
    query,
    language = "en",
    pageSize = 5,
    signal,
}: ListDestinationsOptions = {}) => {
    const params = new URLSearchParams({
        page: "1",
        page_size: String(pageSize),
        language,
    });

    if (query?.trim()) {
        params.set("query", query.trim());
    }

    return request<DestinationListOut>(`/api/swiss/destinations?${params.toString()}`, {
        signal,
    });
};
