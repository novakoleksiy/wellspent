export interface UserOut {
    id: number;
    email: string;
    full_name: string;
    preferences: Record<string, unknown> | null;
    created_at: string;
}

export interface Token {
    access_token: string;
    token_type: string;
}

export interface Preferences {
    budget_tier: string;
    travel_styles: string[];
    accommodation_types: string[];
    pace: string;
    notes: string;
}

export interface RecommendRequest {
    destination?: string;
    start_date: string;
    end_date: string;
    travelers: number;
    budget_max?: number;
    notes: string;
}

export interface Activity {
    time: string;
    title: string;
    category: string;
    cost: number;
}

export interface ItineraryDay {
    day: number;
    date: string;
    activities: Activity[];
}

export interface Itinerary {
    days: ItineraryDay[];
    estimated_total: number;
    currency: string;
}

export interface Recommendation {
    title: string;
    destination: string;
    description: string;
    itinerary: Itinerary;
    match_score: number;
    highlights: string[];
}

export interface TripCreate {
    title: string;
    destination: string;
    description?: string;
    itinerary?: Record<string, unknown>;
}

export interface TripOut {
    id: number;
    title: string;
    destination: string;
    status: string;
    description: string | null;
    itinerary: Itinerary | null;
    created_at: string;
}
