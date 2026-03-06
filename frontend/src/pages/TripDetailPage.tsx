import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getTrip } from "../api/trips";
import type { TripOut } from "../types";

export default function TripDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [trip, setTrip] = useState<TripOut | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getTrip(Number(id))
            .then(setTrip)
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) return <div className="p-8 text-gray-400">Loading…</div>;
    if (!trip) return <div className="p-8 text-red-500">Trip not found.</div>;

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white border-b px-6 py-4 flex items-center gap-4">
                <button onClick={() => navigate("/")} className="text-gray-500 hover:text-gray-800">
                    ← Back
                </button>
                <div>
                    <h1 className="text-xl font-bold">{trip.title}</h1>
                    <p className="text-sm text-gray-500">{trip.destination}</p>
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-6 py-8 space-y-6">
                {trip.description && (
                    <p className="text-gray-600">{trip.description}</p>
                )}

                {trip.itinerary?.days?.map(day => (
                    <div key={day.day} className="bg-white rounded-2xl shadow p-5 space-y-3">
                        <h2 className="font-semibold text-lg">
                            Day {day.day} — {new Date(day.date).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
                        </h2>
                        <div className="space-y-2">
                            {day.activities.map((act, i) => (
                                <div key={i} className="flex justify-between items-center text-sm border-l-2 border-blue-200 pl-3">
                                    <div>
                                        <span className="text-gray-400 mr-2">{act.time}</span>
                                        <span className="font-medium">{act.title}</span>
                                        <span className="ml-2 text-xs text-gray-400 capitalize">{act.category}</span>
                                    </div>
                                    <span className="text-gray-500">${act.cost}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}

                {trip.itinerary && (
                    <div className="text-right text-sm text-gray-500">
                        Estimated total: <strong>${trip.itinerary.estimated_total}</strong> {trip.itinerary.currency}
                    </div>
                )}
            </main>
        </div>
    );
}
