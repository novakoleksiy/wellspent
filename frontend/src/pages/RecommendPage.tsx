import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createTrip, recommend } from "../api/trips";
import type { Recommendation } from "../types";

export default function RecommendPage() {
    const navigate = useNavigate();
    const [form, setForm] = useState({
        destination: "",
        start_date: "",
        end_date: "",
        travelers: 1,
        budget_max: "",
        notes: "",
    });
    const [results, setResults] = useState<Recommendation[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const set = (field: string, value: unknown) =>
        setForm(f => ({ ...f, [field]: value }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            const recs = await recommend({
                destination: form.destination || undefined,
                start_date: form.start_date,
                end_date: form.end_date,
                travelers: form.travelers,
                budget_max: form.budget_max ? Number(form.budget_max) : undefined,
                notes: form.notes,
            });
            setResults(recs);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to get recommendations");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (rec: Recommendation) => {
        await createTrip({
            title: rec.title,
            destination: rec.destination,
            description: rec.description,
            itinerary: rec.itinerary as unknown as Record<string, unknown>,
        });
        navigate("/");
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white border-b px-6 py-4 flex items-center gap-4">
                <button onClick={() => navigate("/")} className="text-gray-500 hover:text-gray-800">
                    ← Back
                </button>
                <h1 className="text-xl font-bold">Plan a trip</h1>
            </header>

            <main className="max-w-2xl mx-auto px-6 py-8 space-y-8">
                <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Destination <span className="text-gray-400">(leave blank to be surprised)</span></label>
                        <input
                            type="text"
                            placeholder="e.g. Tokyo, Japan"
                            value={form.destination}
                            onChange={e => set("destination", e.target.value)}
                            className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Start date</label>
                            <input
                                type="date"
                                required
                                value={form.start_date}
                                onChange={e => set("start_date", e.target.value)}
                                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">End date</label>
                            <input
                                type="date"
                                required
                                value={form.end_date}
                                onChange={e => set("end_date", e.target.value)}
                                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Travelers</label>
                            <input
                                type="number"
                                min={1}
                                value={form.travelers}
                                onChange={e => set("travelers", Number(e.target.value))}
                                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Max budget (USD)</label>
                            <input
                                type="number"
                                placeholder="Optional"
                                value={form.budget_max}
                                onChange={e => set("budget_max", e.target.value)}
                                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Notes</label>
                        <textarea
                            placeholder="Any preferences or requests…"
                            value={form.notes}
                            onChange={e => set("notes", e.target.value)}
                            rows={3}
                            className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    {error && <p className="text-red-500 text-sm">{error}</p>}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                        {loading ? "Finding trips…" : "Get recommendations"}
                    </button>
                </form>

                {results.map((rec, i) => (
                    <div key={i} className="bg-white rounded-2xl shadow p-6 space-y-3">
                        <div className="flex justify-between items-start">
                            <div>
                                <h2 className="text-xl font-semibold">{rec.title}</h2>
                                <p className="text-sm text-gray-500">{rec.destination}</p>
                            </div>
                            <span className="text-sm font-medium text-green-600">
                                {Math.round(rec.match_score * 100)}% match
                            </span>
                        </div>
                        <p className="text-sm text-gray-600">{rec.description}</p>
                        <div className="flex flex-wrap gap-2">
                            {rec.highlights.map(h => (
                                <span key={h} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full">{h}</span>
                            ))}
                        </div>
                        <p className="text-sm text-gray-500">
                            Estimated total: <strong>${rec.itinerary.estimated_total}</strong> {rec.itinerary.currency}
                        </p>
                        <button
                            onClick={() => handleSave(rec)}
                            className="w-full border border-blue-600 text-blue-600 py-2 rounded-lg hover:bg-blue-50"
                        >
                            Save this trip
                        </button>
                    </div>
                ))}
            </main>
        </div>
    );
}
