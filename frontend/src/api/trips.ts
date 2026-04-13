import { request } from "./client";
import type {
    CommunityTripOut,
    Recommendation,
    RecommendRequest,
    TripCreate,
    TripOut,
} from "../types";

export const recommend = (body: RecommendRequest) =>
    request<Recommendation[]>("/api/trips/recommend", {
        method: "POST",
        body: JSON.stringify(body),
    });

export const createTrip = (body: TripCreate) =>
    request<TripOut>("/api/trips/", {
        method: "POST",
        body: JSON.stringify(body),
    });

export const listTrips = () => request<TripOut[]>("/api/trips/");

export const listCommunityTrips = () => request<CommunityTripOut[]>("/api/trips/community");

export const getTrip = (id: number) => request<TripOut>(`/api/trips/${id}`);

export const setTripShared = (id: number, shared: boolean) =>
    request<TripOut>(`/api/trips/${id}/share`, {
        method: "PATCH",
        body: JSON.stringify({ shared }),
    });

export const deleteTrip = (id: number) =>
    request<void>(`/api/trips/${id}`, { method: "DELETE" });
