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
    budget_tier?: "budget" | "mid" | "luxury";
}

export interface Activity {
    id?: string;
    time: string;
    title: string;
    category: string;
    cost: number;
    url?: string | null;
    image_url?: string | null;
    description?: string | null;
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
    transport_legs?: TransportLeg[];
    notes?: string | null;
    url?: string | null;
    image_url?: string | null;
    description?: string | null;
    refreshable: boolean;
}

export interface TransportLeg {
    mode: string;
    line?: string | null;
    departure_time?: string | null;
    arrival_time?: string | null;
    duration_minutes?: number | null;
    origin: string;
    destination: string;
    direction?: string | null;
    notes: string;
}

export interface ItineraryDay {
    day: number;
    date: string;
    theme?: string | null;
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

export type TripStatus = "draft" | "recommended" | "booked" | "completed" | "cancelled";

export interface TripOut {
    id: number;
    title: string;
    destination: string;
    status: TripStatus;
    description: string | null;
    itinerary: Itinerary | null;
    created_at: string;
    shared_at: string | null;
    folder_id: number | null;
    completion_rating: number | null;
    completion_comment: string | null;
    completion_image_urls: string[];
    completed_at: string | null;
}

export interface TripCompleteRequest {
    rating: number;
    comment?: string | null;
    image_urls?: string[];
}

export interface FolderCreate {
    name: string;
    description?: string | null;
}

export interface FolderUpdate {
    name: string;
    description?: string | null;
}

export interface FolderOut {
    id: number;
    name: string;
    description: string | null;
    created_at: string;
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

export interface GeoOut {
    latitude: number;
    longitude: number;
}

export interface ImageOut {
    url: string;
    title: string;
}

export interface PaginationOut {
    page_number: number;
    page_size: number;
    total_elements: number;
    total_pages: number;
}

export interface DestinationOut {
    id: string;
    name: string;
    category?: string | null;
    description: string;
    geo?: GeoOut | null;
    images: ImageOut[];
    url: string;
}

export interface DestinationListOut {
    data: DestinationOut[];
    pagination: PaginationOut;
}

export interface TourProvider {
    name: string;
    url?: string | null;
    email?: string | null;
    phone?: string | null;
    locality?: string | null;
}

export interface TourOut {
    id: string;
    name: string;
    description: string;
    distance_km?: number | null;
    duration_minutes?: number | null;
    ascent_m?: number | null;
    descent_m?: number | null;
    route_type?: string | null;
    difficulty?: string | null;
    waypoints: string[];
    tourist_types: string[];
    provider?: TourProvider | null;
    geo?: GeoOut | null;
    images: ImageOut[];
    url: string;
}

export interface TourListOut {
    data: TourOut[];
    pagination: PaginationOut;
}
