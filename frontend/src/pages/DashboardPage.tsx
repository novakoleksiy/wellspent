import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { createFolder, deleteFolder, listFolders } from "../api/folders";
import { deleteTrip, listTrips, setTripFolder, setTripShared, setTripStatus } from "../api/trips";
import AppShell from "../components/AppShell";
import type { FolderOut, TripOut } from "../types";

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatMoney(total: number | undefined, currency: string | undefined): string {
  if (typeof total !== "number") {
    return "Estimate pending";
  }

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "CHF",
    maximumFractionDigits: 0,
  }).format(total);
}

export default function TripsPage() {
  const [trips, setTrips] = useState<TripOut[]>([]);
  const [folders, setFolders] = useState<FolderOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deletingFolderId, setDeletingFolderId] = useState<number | null>(null);
  const [sharingId, setSharingId] = useState<number | null>(null);
  const [completingId, setCompletingId] = useState<number | null>(null);
  const [movingId, setMovingId] = useState<number | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<number | "all" | "unfiled">("all");
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [folderDescription, setFolderDescription] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);

  useEffect(() => {
    Promise.all([listTrips(), listFolders()])
      .then(([nextTrips, nextFolders]) => {
        setTrips(nextTrips);
        setFolders(nextFolders);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Unable to load trips");
      })
      .finally(() => setLoading(false));
  }, []);

  const visibleTrips = trips.filter((trip) => {
    if (selectedFolderId === "all") {
      return true;
    }

    if (selectedFolderId === "unfiled") {
      return (trip.folder_id ?? null) === null;
    }

    return trip.folder_id === selectedFolderId;
  });
  const totalActiveTrips = trips.filter((trip) => trip.status !== "completed").length;
  const activeTrips = visibleTrips.filter((trip) => trip.status !== "completed");
  const pastTrips = visibleTrips.filter((trip) => trip.status === "completed");
  const itinerariesCount = trips.filter((trip) => trip.itinerary?.days?.length).length;
  const unfiledTripsCount = trips.filter((trip) => (trip.folder_id ?? null) === null).length;
  const selectedFolder = typeof selectedFolderId === "number"
    ? folders.find((folder) => folder.id === selectedFolderId)
    : null;
  const selectedTripsLabel = selectedFolderId === "all"
    ? "All Trips"
    : selectedFolderId === "unfiled"
      ? "Unfiled Trips"
      : selectedFolder?.name || "Folder";

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await deleteTrip(id);
      setTrips((current) => current.filter((trip) => trip.id !== id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to delete trip");
    } finally {
      setDeletingId(null);
    }
  };

  const handleShareToggle = async (trip: TripOut) => {
    setSharingId(trip.id);
    setError("");
    try {
      const updatedTrip = await setTripShared(trip.id, !trip.shared_at);
      setTrips((current) => current.map((item) => (item.id === trip.id ? updatedTrip : item)));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to update community sharing");
    } finally {
      setSharingId(null);
    }
  };

  const handleCompleteTrip = async (trip: TripOut) => {
    setCompletingId(trip.id);
    setError("");
    try {
      const updatedTrip = await setTripStatus(trip.id, "completed");
      setTrips((current) => current.map((item) => (item.id === trip.id ? updatedTrip : item)));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to complete trip");
    } finally {
      setCompletingId(null);
    }
  };

  const handleCreateFolder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = folderName.trim();
    const description = folderDescription.trim();

    if (!name) {
      setError("Folder name is required");
      return;
    }

    setCreatingFolder(true);
    setError("");
    try {
      const folder = await createFolder({
        name,
        description: description || null,
      });
      setFolders((current) => [folder, ...current]);
      setSelectedFolderId(folder.id);
      setFolderName("");
      setFolderDescription("");
      setIsCreateFolderOpen(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to create folder");
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleMoveTrip = async (trip: TripOut, folderId: number | null) => {
    if (trip.folder_id === folderId) {
      return;
    }

    setMovingId(trip.id);
    setError("");
    try {
      const updatedTrip = await setTripFolder(trip.id, folderId);
      setTrips((current) => current.map((item) => (item.id === trip.id ? updatedTrip : item)));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to move trip");
    } finally {
      setMovingId(null);
    }
  };

  const handleDeleteFolder = async (folder: FolderOut) => {
    const tripCount = trips.filter((trip) => trip.folder_id === folder.id).length;
    const confirmed = window.confirm(
      tripCount > 0
        ? `Delete "${folder.name}"? Its ${tripCount} trip${tripCount === 1 ? "" : "s"} will move back to Unfiled.`
        : `Delete "${folder.name}"?`
    );

    if (!confirmed) {
      return;
    }

    setDeletingFolderId(folder.id);
    setError("");
    try {
      await deleteFolder(folder.id);
      setFolders((current) => current.filter((item) => item.id !== folder.id));
      setTrips((current) => current.map((trip) => (
        trip.folder_id === folder.id ? { ...trip, folder_id: null } : trip
      )));
      setSelectedFolderId((current) => (current === folder.id ? "all" : current));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to delete folder");
    } finally {
      setDeletingFolderId(null);
    }
  };

  function renderTripSection(label: string, title: string, items: TripOut[], emptyLabel: string) {
    return (
      <section className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-6 shadow-sm sm:p-7">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-500">{label}</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{title}</h2>
          </div>
          <span className="rounded-full bg-stone-100 px-4 py-2 text-sm font-medium text-slate-600">
            {items.length}
          </span>
        </div>

        {items.length === 0 ? (
          <div className="mt-6 rounded-[1.75rem] border border-dashed border-slate-300 bg-stone-50/70 px-6 py-10 text-center">
            <p className="text-sm font-semibold tracking-[0.2em] text-slate-500 uppercase">Nothing here yet</p>
            <p className="mt-3 text-base leading-7 text-slate-500">{emptyLabel}</p>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map((trip) => {
              const dayCount = trip.itinerary?.days?.length ?? 0;

              return (
                <article
                  key={trip.id}
                  className="rounded-[1.75rem] border border-slate-200/80 bg-stone-50 px-5 py-5 transition hover:border-slate-300 hover:bg-white"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-500">{trip.destination}</p>
                      <p className="mt-2 text-xl font-semibold tracking-tight text-slate-900">{trip.title}</p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-500 shadow-sm">
                      {formatDate(trip.created_at)}
                    </span>
                  </div>

                  <p className="mt-4 text-sm leading-6 text-slate-500">
                    {trip.description || "Saved from your recommendation flow and ready to revisit."}
                  </p>

                  <div className="mt-5 grid grid-cols-2 gap-3 rounded-[1.5rem] bg-white/80 p-4 text-sm text-slate-600">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Days</p>
                      <p className="mt-2 font-medium text-slate-800">{dayCount || "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Status</p>
                      <p className="mt-2 font-medium capitalize text-slate-800">{trip.status}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Community</p>
                      <p className="mt-2 font-medium text-slate-800">{trip.shared_at ? "Shared" : "Private"}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Estimated total</p>
                      <p className="mt-2 font-medium text-slate-800">
                        {formatMoney(trip.itinerary?.estimated_total, trip.itinerary?.currency)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
                    <Link
                      to={`/trips/${trip.id}`}
                      className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      View itinerary
                    </Link>
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-2 text-sm font-medium text-slate-500">
                        Folder
                        <select
                          value={trip.folder_id ?? ""}
                          onChange={(event) => {
                            const nextFolderId = event.target.value ? Number(event.target.value) : null;
                            void handleMoveTrip(trip, nextFolderId);
                          }}
                          disabled={movingId === trip.id}
                          className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <option value="">No folder</option>
                          {folders.map((folder) => (
                            <option key={folder.id} value={folder.id}>
                              {folder.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      {trip.status !== "completed" && (
                        <button
                          type="button"
                          onClick={() => handleCompleteTrip(trip)}
                          disabled={completingId === trip.id}
                          className="font-medium text-emerald-700 transition hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {completingId === trip.id ? "Completing..." : "Complete Trip"}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleShareToggle(trip)}
                        disabled={sharingId === trip.id}
                        className="font-medium text-slate-600 transition hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {sharingId === trip.id
                          ? trip.shared_at
                            ? "Unsharing..."
                            : "Sharing..."
                          : trip.shared_at
                            ? "Remove from community"
                            : "Share with community"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(trip.id)}
                        disabled={deletingId === trip.id}
                        className="font-medium text-rose-600 transition hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deletingId === trip.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    );
  }

  return (
    <AppShell
      title="My Trips"
      actions={
        <>
          <button
            type="button"
            onClick={() => setIsCreateFolderOpen((open) => !open)}
            className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
          >
            Create Folder
          </button>
          <Link
            to="/plan"
            className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition hover:bg-slate-800"
          >
            Plan a trip
          </Link>
        </>
      }
    >
      <div className="space-y-6">
        {isCreateFolderOpen && (
          <form
            onSubmit={handleCreateFolder}
            className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-5 shadow-sm sm:p-6"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
              <div className="flex-1">
                <label className="text-sm font-medium text-slate-600" htmlFor="folder-name">
                  Folder name
                </label>
                <input
                  id="folder-name"
                  value={folderName}
                  onChange={(event) => setFolderName(event.target.value)}
                  placeholder="Weekend escapes"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                />
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium text-slate-600" htmlFor="folder-description">
                  Description <span className="text-slate-400">optional</span>
                </label>
                <input
                  id="folder-description"
                  value={folderDescription}
                  onChange={(event) => setFolderDescription(event.target.value)}
                  placeholder="Ideas for quick train trips"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateFolderOpen(false)}
                  className="rounded-full px-5 py-3 text-sm font-semibold text-slate-500 transition hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingFolder}
                  className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {creatingFolder ? "Creating..." : "Create"}
                </button>
              </div>
            </div>
          </form>
        )}

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[2rem] border border-slate-200/80 bg-white/85 p-6 shadow-sm">
            <p className="text-sm text-slate-500">Total trips</p>
            <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">{trips.length}</p>
          </div>
          <div className="rounded-[2rem] border border-slate-200/80 bg-white/85 p-6 shadow-sm">
            <p className="text-sm text-slate-500">Active trips</p>
            <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">{totalActiveTrips}</p>
          </div>
          <div className="rounded-[2rem] border border-slate-200/80 bg-slate-900 p-6 text-white shadow-lg shadow-slate-900/10">
            <p className="text-sm text-white/70">Saved itineraries</p>
            <p className="mt-3 text-4xl font-semibold tracking-tight text-white">{itinerariesCount}</p>
            <p className="mt-2 text-sm leading-6 text-white/70">
              Keep drafts in motion and hold onto the trips worth repeating.
            </p>
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-6 shadow-sm sm:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Folders</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                Organize trips by plan, season, or idea.
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedFolderId("all")}
                className={selectedFolderId === "all"
                  ? "rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                  : "rounded-full bg-stone-100 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-stone-200"}
              >
                All Trips
              </button>
              <button
                type="button"
                onClick={() => setSelectedFolderId("unfiled")}
                className={selectedFolderId === "unfiled"
                  ? "rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                  : "rounded-full bg-stone-100 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-stone-200"}
              >
                Unfiled {unfiledTripsCount}
              </button>
            </div>
          </div>

          {loading ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="h-48 animate-pulse rounded-[1.75rem] bg-stone-100" />
              <div className="h-48 animate-pulse rounded-[1.75rem] bg-stone-100" />
              <div className="h-48 animate-pulse rounded-[1.75rem] bg-stone-100" />
            </div>
          ) : folders.length === 0 ? (
            <div className="mt-6 rounded-[1.75rem] border border-dashed border-slate-300 bg-stone-50/70 px-6 py-8 text-center">
              <p className="text-sm font-semibold tracking-[0.2em] text-slate-500 uppercase">No folders yet</p>
              <p className="mt-3 text-base leading-7 text-slate-500">
                Create a folder to group active plans, past favorites, or ideas for later.
              </p>
            </div>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {folders.map((folder) => {
                const folderTrips = trips.filter((trip) => trip.folder_id === folder.id);
                const activeCount = folderTrips.filter((trip) => trip.status !== "completed").length;
                const pastCount = folderTrips.length - activeCount;

                return (
                  <article
                    key={folder.id}
                    className={selectedFolderId === folder.id
                      ? "rounded-[1.75rem] border border-slate-900 bg-slate-900 px-5 py-5 text-white shadow-lg shadow-slate-900/10"
                      : "rounded-[1.75rem] border border-slate-200/80 bg-stone-50 px-5 py-5 transition hover:border-slate-300 hover:bg-white"}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedFolderId(folder.id)}
                      className="block w-full text-left"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className={selectedFolderId === folder.id
                            ? "text-sm font-medium text-white/70"
                            : "text-sm font-medium text-slate-500"}
                          >
                            Folder
                          </p>
                          <h3 className="mt-2 text-xl font-semibold tracking-tight">{folder.name}</h3>
                        </div>
                        <span className={selectedFolderId === folder.id
                          ? "rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white"
                          : "rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-500 shadow-sm"}
                        >
                          {folderTrips.length} trips
                        </span>
                      </div>
                      <p className={selectedFolderId === folder.id
                        ? "mt-4 text-sm leading-6 text-white/70"
                        : "mt-4 text-sm leading-6 text-slate-500"}
                      >
                        {folder.description || "A saved collection for related active and past trips."}
                      </p>
                      <div className={selectedFolderId === folder.id
                        ? "mt-5 grid grid-cols-2 gap-3 rounded-[1.5rem] bg-white/10 p-4 text-sm text-white/75"
                        : "mt-5 grid grid-cols-2 gap-3 rounded-[1.5rem] bg-white/80 p-4 text-sm text-slate-600"}
                      >
                        <div>
                          <p className={selectedFolderId === folder.id
                            ? "text-xs tracking-[0.18em] text-white/50 uppercase"
                            : "text-xs tracking-[0.18em] text-slate-400 uppercase"}
                          >
                            Active
                          </p>
                          <p className="mt-2 font-medium">{activeCount}</p>
                        </div>
                        <div>
                          <p className={selectedFolderId === folder.id
                            ? "text-xs tracking-[0.18em] text-white/50 uppercase"
                            : "text-xs tracking-[0.18em] text-slate-400 uppercase"}
                          >
                            Past
                          </p>
                          <p className="mt-2 font-medium">{pastCount}</p>
                        </div>
                      </div>
                    </button>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => setSelectedFolderId(folder.id)}
                        className={selectedFolderId === folder.id
                          ? "text-sm font-semibold text-white transition hover:text-white/80"
                          : "text-sm font-semibold text-slate-700 transition hover:text-slate-900"}
                      >
                        View folder
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteFolder(folder)}
                        disabled={deletingFolderId === folder.id}
                        className={selectedFolderId === folder.id
                          ? "text-sm font-semibold text-rose-100 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                          : "text-sm font-semibold text-rose-600 transition hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"}
                      >
                        {deletingFolderId === folder.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {error && (
          <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </p>
        )}

        {loading ? (
          <div className="grid gap-6 xl:grid-cols-2">
            <div className="h-80 animate-pulse rounded-[2rem] bg-white/70 shadow-sm" />
            <div className="h-80 animate-pulse rounded-[2rem] bg-white/70 shadow-sm" />
          </div>
        ) : trips.length === 0 ? (
          <section className="rounded-[2.5rem] border border-dashed border-slate-300 bg-white/60 px-6 py-14 text-center shadow-sm sm:px-10">
            <p className="text-sm font-semibold tracking-[0.22em] text-slate-500 uppercase">Ready to start</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
              Your trip history will build from here.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-slate-500">
              Generate a tailored itinerary, save the one that fits best, and come back to it anytime.
            </p>
            <Link
              to="/plan"
              className="mt-8 inline-flex rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition hover:bg-slate-800"
            >
              Plan your first trip
            </Link>
          </section>
        ) : (
          <>
            {renderTripSection(
              selectedTripsLabel,
              "Trips you are still planning or keeping active.",
              activeTrips,
              selectedFolderId === "all"
                ? "Your in-progress trips and open itineraries will appear here."
                : "No active trips are assigned here yet."
            )}
            {renderTripSection(
              selectedTripsLabel,
              "Trips and itineraries you have already completed.",
              pastTrips,
              selectedFolderId === "all"
                ? "Completed trips will appear here once their status is marked as completed."
                : "No completed trips are assigned here yet."
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
