import { request } from "./client";
import type {
    DestinationListOut,
    OfferListOut,
    OfferOut,
    TourListOut,
    TourOut,
} from "../types";

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

type ListToursOptions = {
    query?: string;
    page?: number;
    pageSize?: number;
    signal?: AbortSignal;
};

export const listTours = ({
    query,
    page = 1,
    pageSize = 12,
    signal,
}: ListToursOptions = {}) => {
    const params = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
    });

    if (query?.trim()) {
        params.set("query", query.trim());
    }

    return request<TourListOut>(`/api/swiss/tours?${params.toString()}`, { signal });
};

export const getTour = (id: string) =>
    request<TourOut>(`/api/swiss/tours/${encodeURIComponent(id)}`);

type ListOffersOptions = {
    query?: string;
    page?: number;
    pageSize?: number;
    signal?: AbortSignal;
};

export const listOffers = ({
    query,
    page = 1,
    pageSize = 12,
    signal,
}: ListOffersOptions = {}) => {
    const params = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
    });

    if (query?.trim()) {
        params.set("query", query.trim());
    }

    return request<OfferListOut>(`/api/swiss/offers?${params.toString()}`, { signal });
};

export const getOffer = (id: string) =>
    request<OfferOut>(`/api/swiss/offers/${encodeURIComponent(id)}`);
