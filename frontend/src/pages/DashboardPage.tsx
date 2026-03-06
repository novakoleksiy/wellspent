import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { deleteTrip, listTrips } from "../api/trips";
import { useAuth } from "../hooks/useAuth";
import type { TripOut } from "../types";

export default function DashboardPage() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [trips, setTrips] = useState<TripOut[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        listTrips()
            .then(setTrips)
            .finally(() => setLoading(false));
    }, []);

    const handleDelete = async (id: number) => {
        await deleteTrip(id);
        setTrips(trips.filter(t => t.id !== id));
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white border-b px-6 py-4 flex justify-between items-center">
                <h1 className="text-xl font-bold">WellSpent</h1>
                <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-500">{user?.full_name}</span>
                    <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-800">
                        Sign out
                    </button>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-6 py-8">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-semibold">Your trips</h2>
                    <Link
                        to="/recommend"
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                    >
                        Plan a trip
                    </Link>
                </div>

                {loading && <p className="text-gray-400">Loading…</p>}

                {!loading && trips.length === 0 && (
                    <p className="text-gray-400">No trips yet. Plan your first one!</p>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                    {trips.map(trip => (
                        <div key={trip.id} className="bg-white rounded-2xl shadow p-5 flex flex-col gap-2">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-semibold text-lg">{trip.title}</h3>
                                    <p className="text-sm text-gray-500">{trip.destination}</p>
                                </div>
                                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full capitalize">
                                    {trip.status}
                                </span>
                            </div>
                            <p className="text-xs text-gray-400">
                                {new Date(trip.created_at).toLocaleDateString()}
                            </p>
                            <div className="flex gap-2 mt-auto pt-2">
                                <button
                                    onClick={() => navigate(`/trips/${trip.id}`)}
                                    className="text-sm text-blue-600 hover:underline"
                                >
                                    View
                                </button>
                                <button
                                    onClick={() => handleDelete(trip.id)}
                                    className="text-sm text-red-500 hover:underline"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
}
