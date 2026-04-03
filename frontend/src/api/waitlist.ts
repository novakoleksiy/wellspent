import { request } from "./client";

export interface JoinWaitlistRequest {
    email: string;
    name?: string;
}

export interface WaitlistResponse {
    message: string;
}

export interface PublicSettings {
    registration_open: boolean;
}

export const joinWaitlist = (data: JoinWaitlistRequest) =>
    request<WaitlistResponse>("/api/waitlist", {
        method: "POST",
        body: JSON.stringify(data),
    });

export const getPublicSettings = () =>
    request<PublicSettings>("/api/settings/public");
