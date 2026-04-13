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
    mood: "culture_history" | "nature_outdoors" | "food_markets" | "slow_relaxing";
    transport_mode: "car" | "public_transport";
    trip_length: "2_3_hours" | "half_day" | "full_day";
    group_type: "solo" | "couple" | "family" | "friends";
}

export interface Activity {
    id?: string;
    time: string;
    title: string;
    category: string;
    cost: number;
    url?: string | null;
}

export interface TimelineItem {
    id: string;
    kind: "activity" | "transport";
    time: string;
    title: string;
    category: string;
    cost: number;
    duration_text?: string | null;
    transport_mode?: string | null;
    notes?: string | null;
    url?: string | null;
    refreshable: boolean;
}

export interface ItineraryDay {
    day: number;
    date: string;
    activities: Activity[];
    timeline_items?: TimelineItem[];
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

export interface RefreshRecommendationItemRequest extends RecommendRequest {
    itinerary: Itinerary;
    item_id: string;
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
    shared_at: string | null;
}

export interface CommunityTripOut {
    id: number;
    title: string;
    destination: string;
    description: string | null;
    itinerary: Itinerary | null;
    created_at: string;
    shared_at: string;
    owner_name: string;
}
