import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { createFolder, deleteFolder, listFolders } from "../api/folders";
import { completeTrip, deleteTrip, listTrips, setTripFolder, setTripShared } from "../api/trips";
import AppShell from "../components/AppShell";
import TripCompletionModal from "../components/TripCompletionModal";
import type { FolderOut, TripCompleteRequest, TripOut } from "../types";

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatMonth(date: string): string {
  return new Date(date).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
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
  const [activeView, setActiveView] = useState<"active" | "past">("active");
  const [pastSearch, setPastSearch] = useState("");
  const [pastSharedFilter, setPastSharedFilter] = useState<"all" | "shared" | "private">("all");
  const [pastSort, setPastSort] = useState<"recent" | "oldest">("recent");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deletingFolderId, setDeletingFolderId] = useState<number | null>(null);
  const [sharingId, setSharingId] = useState<number | null>(null);
  const [completingId, setCompletingId] = useState<number | null>(null);
  const [movingId, setMovingId] = useState<number | null>(null);
  const [openTripActionsId, setOpenTripActionsId] = useState<number | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<number | "all" | "unfiled">("all");
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [folderDescription, setFolderDescription] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [completionTrip, setCompletionTrip] = useState<TripOut | null>(null);

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

  useEffect(() => {
    if (openTripActionsId === null) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenTripActionsId(null);
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest("[data-trip-actions]")) {
        return;
      }

      setOpenTripActionsId(null);
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [openTripActionsId]);

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
  const pastArchiveTrips = pastTrips
    .filter((trip) => {
      const query = pastSearch.trim().toLowerCase();
      const matchesSearch = query.length === 0
        || trip.title.toLowerCase().includes(query)
        || trip.destination.toLowerCase().includes(query)
        || (trip.description || "").toLowerCase().includes(query);
      const matchesSharing = pastSharedFilter === "all"
        || (pastSharedFilter === "shared" ? Boolean(trip.shared_at) : !trip.shared_at);

      return matchesSearch && matchesSharing;
    })
    .sort((first, second) => {
      const firstTime = new Date(first.created_at).getTime();
      const secondTime = new Date(second.created_at).getTime();

      return pastSort === "recent" ? secondTime - firstTime : firstTime - secondTime;
    });
  const pastArchiveGroups = pastArchiveTrips.reduce<Array<{ label: string; items: TripOut[] }>>((groups, trip) => {
    const label = formatMonth(trip.created_at);
    const existingGroup = groups.find((group) => group.label === label);

    if (existingGroup) {
      existingGroup.items.push(trip);
    } else {
      groups.push({ label, items: [trip] });
    }

    return groups;
  }, []);
  const totalPastDays = pastTrips.reduce((total, trip) => total + (trip.itinerary?.days?.length ?? 0), 0);
  const sharedPastTrips = pastTrips.filter((trip) => trip.shared_at).length;
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

  const openCompleteTrip = (trip: TripOut) => {
    setCompletionTrip(trip);
  };

  const closeCompleteTrip = () => {
    setCompletionTrip(null);
  };

  const handleCompleteTrip = async (body: TripCompleteRequest) => {
    if (!completionTrip) {
      throw new Error("No trip selected");
    }

    setCompletingId(completionTrip.id);
    setError("");
    try {
      const updatedTrip = await completeTrip(completionTrip.id, body);
      setTrips((current) => current.map((item) => (item.id === completionTrip.id ? updatedTrip : item)));
      setCompletionTrip(updatedTrip);
      return updatedTrip;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to complete trip");
      throw err;
    } finally {
      setCompletingId(null);
    }
  };

  const handleShareCompletedTrip = async (trip: TripOut) => {
    setSharingId(trip.id);
    setError("");
    try {
      const updatedTrip = await setTripShared(trip.id, true);
      setTrips((current) => current.map((item) => (item.id === updatedTrip.id ? updatedTrip : item)));
      setCompletionTrip(updatedTrip);
      return updatedTrip;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to share trip with the community");
      throw err;
    } finally {
      setSharingId(null);
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

  function renderTripActions(trip: TripOut) {
    const isOpen = openTripActionsId === trip.id;
    const menuItemClass = "flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-medium text-slate-600 transition hover:bg-stone-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60";
    const dangerItemClass = "flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-semibold text-rose-600 transition hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-60";

    return (
      <div className="mt-5 flex items-center gap-3">
        <Link
          to={`/trips/${trip.id}`}
          className="inline-flex flex-1 justify-center rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold !text-white transition hover:bg-slate-800"
        >
          View itinerary
        </Link>
        <div className="relative" data-trip-actions>
          <button
            type="button"
            aria-label={`Trip actions for ${trip.title}`}
            aria-expanded={isOpen}
            onClick={() => setOpenTripActionsId((current) => (current === trip.id ? null : trip.id))}
            className="inline-flex size-10 items-center justify-center rounded-full border border-slate-200 bg-white text-lg font-semibold leading-none text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
          >
            ⋯
          </button>

          {isOpen && (
            <div className="absolute right-0 bottom-12 z-20 w-64 rounded-[1.5rem] border border-slate-200 bg-white p-2 shadow-xl shadow-slate-900/10">
              <div className="px-3 py-2">
                <p className="text-xs font-semibold tracking-[0.16em] text-slate-400 uppercase">Move to folder</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOpenTripActionsId(null);
                  void handleMoveTrip(trip, null);
                }}
                disabled={movingId === trip.id || (trip.folder_id ?? null) === null}
                className={menuItemClass}
              >
                <span>No folder</span>
                {(trip.folder_id ?? null) === null && <span className="text-xs text-slate-400">Current</span>}
              </button>
              {folders.map((folder) => (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => {
                    setOpenTripActionsId(null);
                    void handleMoveTrip(trip, folder.id);
                  }}
                  disabled={movingId === trip.id || trip.folder_id === folder.id}
                  className={menuItemClass}
                >
                  <span>{folder.name}</span>
                  {trip.folder_id === folder.id && <span className="text-xs text-slate-400">Current</span>}
                </button>
              ))}

              <div className="my-2 h-px bg-slate-100" />

              {trip.status !== "completed" && (
                <button
                  type="button"
                  onClick={() => {
                    setOpenTripActionsId(null);
                    openCompleteTrip(trip);
                  }}
                  disabled={completingId === trip.id}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {completingId === trip.id ? "Completing..." : "Complete trip"}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setOpenTripActionsId(null);
                  void handleShareToggle(trip);
                }}
                disabled={sharingId === trip.id}
                className={menuItemClass}
              >
                {sharingId === trip.id
                  ? trip.shared_at
                    ? "Unsharing..."
                    : "Sharing..."
                  : trip.shared_at
                    ? "Remove from community"
                    : "Share with community"}
              </button>

              <div className="my-2 h-px bg-slate-100" />

              <button
                type="button"
                onClick={() => {
                  setOpenTripActionsId(null);
                  void handleDelete(trip.id);
                }}
                disabled={deletingId === trip.id}
                className={dangerItemClass}
              >
                {deletingId === trip.id ? "Deleting..." : "Delete trip"}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

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

                  {renderTripActions(trip)}
                </article>
              );
            })}
          </div>
        )}
      </section>
    );
  }

  function renderPastArchive() {
    return (
      <section className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-6 shadow-sm sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">{selectedTripsLabel}</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Past Trips Archive</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
              Revisit completed itineraries, share the ones worth recommending, and use past plans as a shortcut for your next trip.
            </p>
          </div>
          <div className="grid min-w-full gap-3 sm:grid-cols-3 lg:min-w-[360px]">
            <div className="rounded-[1.5rem] bg-stone-50 px-4 py-4">
              <p className="text-xs font-medium tracking-[0.16em] text-slate-400 uppercase">Completed</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{pastTrips.length}</p>
            </div>
            <div className="rounded-[1.5rem] bg-stone-50 px-4 py-4">
              <p className="text-xs font-medium tracking-[0.16em] text-slate-400 uppercase">Trip days</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{totalPastDays}</p>
            </div>
            <div className="rounded-[1.5rem] bg-stone-50 px-4 py-4">
              <p className="text-xs font-medium tracking-[0.16em] text-slate-400 uppercase">Shared</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{sharedPastTrips}</p>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-[1fr_auto_auto]">
          <label className="sr-only" htmlFor="past-trip-search">Search past trips</label>
          <input
            id="past-trip-search"
            type="search"
            value={pastSearch}
            onChange={(event) => setPastSearch(event.target.value)}
            placeholder="Search destination, title, or notes"
            className="min-w-0 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400"
          />
          <label className="sr-only" htmlFor="past-trip-sharing">Filter by sharing</label>
          <select
            id="past-trip-sharing"
            value={pastSharedFilter}
            onChange={(event) => setPastSharedFilter(event.target.value as "all" | "shared" | "private")}
            className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-600 outline-none transition focus:border-slate-400"
          >
            <option value="all">All visibility</option>
            <option value="shared">Shared only</option>
            <option value="private">Private only</option>
          </select>
          <label className="sr-only" htmlFor="past-trip-sort">Sort past trips</label>
          <select
            id="past-trip-sort"
            value={pastSort}
            onChange={(event) => setPastSort(event.target.value as "recent" | "oldest")}
            className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-600 outline-none transition focus:border-slate-400"
          >
            <option value="recent">Most recent</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>

        {pastTrips.length === 0 ? (
          <div className="mt-6 rounded-[1.75rem] border border-dashed border-slate-300 bg-stone-50/70 px-6 py-10 text-center">
            <p className="text-sm font-semibold tracking-[0.2em] text-slate-500 uppercase">No completed trips yet</p>
            <p className="mt-3 text-base leading-7 text-slate-500">
              Mark a trip as complete to start building your archive of repeatable itineraries.
            </p>
          </div>
        ) : pastArchiveTrips.length === 0 ? (
          <div className="mt-6 rounded-[1.75rem] border border-dashed border-slate-300 bg-stone-50/70 px-6 py-10 text-center">
            <p className="text-sm font-semibold tracking-[0.2em] text-slate-500 uppercase">No matches</p>
            <p className="mt-3 text-base leading-7 text-slate-500">
              Try a different search term or visibility filter.
            </p>
          </div>
        ) : (
          <div className="mt-8 space-y-8">
            {pastArchiveGroups.map((group) => (
              <div key={group.label}>
                <div className="mb-4 flex items-center gap-4">
                  <h3 className="text-sm font-semibold tracking-[0.18em] text-slate-400 uppercase">{group.label}</h3>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {group.items.map((trip) => {
                    const dayCount = trip.itinerary?.days?.length ?? 0;

                    return (
                      <article
                        key={trip.id}
                        className="rounded-[1.75rem] border border-slate-200/80 bg-stone-50 px-5 py-5 transition hover:border-slate-300 hover:bg-white"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-slate-500">{trip.destination}</p>
                            <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">{trip.title}</h3>
                          </div>
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-500 shadow-sm">
                            {formatDate(trip.created_at)}
                          </span>
                        </div>

                        <p className="mt-4 line-clamp-2 text-sm leading-6 text-slate-500">
                          {trip.description || "Saved from your recommendation flow and ready to revisit."}
                        </p>

                        <div className="mt-5 flex flex-wrap gap-2 text-sm text-slate-500">
                          <span className="rounded-full bg-white px-3 py-1.5 font-medium shadow-sm">
                            {dayCount || "-"} day{dayCount === 1 ? "" : "s"}
                          </span>
                          <span className="rounded-full bg-white px-3 py-1.5 font-medium shadow-sm">
                            {formatMoney(trip.itinerary?.estimated_total, trip.itinerary?.currency)}
                          </span>
                          <span className="rounded-full bg-white px-3 py-1.5 font-medium shadow-sm">
                            {trip.shared_at ? "Shared" : "Private"}
                          </span>
                        </div>

                        {renderTripActions(trip)}
                      </article>
                    );
                  })}
                </div>
              </div>
            ))}
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
            className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold !text-white shadow-lg shadow-slate-900/10 transition hover:bg-slate-800"
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Folders</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                Filter active and past trips by collection.
              </h2>
            </div>
            <p className="text-sm font-medium text-slate-500">Showing {selectedTripsLabel}</p>
          </div>

          {loading ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="h-36 animate-pulse rounded-[2rem] bg-stone-100" />
              <div className="h-36 animate-pulse rounded-[2rem] bg-stone-100" />
              <div className="h-36 animate-pulse rounded-[2rem] bg-stone-100" />
              <div className="h-36 animate-pulse rounded-[2rem] bg-stone-100" />
            </div>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <button
                type="button"
                onClick={() => setSelectedFolderId("all")}
                className={selectedFolderId === "all"
                  ? "rounded-[2rem] border border-slate-900 bg-slate-900 p-6 text-left text-white shadow-lg shadow-slate-900/10"
                  : "rounded-[2rem] border border-slate-200/80 bg-white/85 p-6 text-left shadow-sm transition hover:border-slate-300 hover:bg-white"}
              >
                <p className={selectedFolderId === "all" ? "text-sm text-white/70" : "text-sm text-slate-500"}>All collections</p>
                <p className="mt-3 text-4xl font-semibold tracking-tight">{trips.length}</p>
                <p className={selectedFolderId === "all" ? "mt-2 text-sm text-white/70" : "mt-2 text-sm text-slate-500"}>
                  Every active and past trip.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSelectedFolderId("unfiled")}
                className={selectedFolderId === "unfiled"
                  ? "rounded-[2rem] border border-slate-900 bg-slate-900 p-6 text-left text-white shadow-lg shadow-slate-900/10"
                  : "rounded-[2rem] border border-slate-200/80 bg-white/85 p-6 text-left shadow-sm transition hover:border-slate-300 hover:bg-white"}
              >
                <p className={selectedFolderId === "unfiled" ? "text-sm text-white/70" : "text-sm text-slate-500"}>Unfiled</p>
                <p className="mt-3 text-4xl font-semibold tracking-tight">{unfiledTripsCount}</p>
                <p className={selectedFolderId === "unfiled" ? "mt-2 text-sm text-white/70" : "mt-2 text-sm text-slate-500"}>
                  Trips waiting for a collection.
                </p>
              </button>

              {folders.map((folder) => {
                const folderTrips = trips.filter((trip) => trip.folder_id === folder.id);
                const activeCount = folderTrips.filter((trip) => trip.status !== "completed").length;
                const pastCount = folderTrips.length - activeCount;
                const selected = selectedFolderId === folder.id;

                return (
                  <article
                    key={folder.id}
                    className={selected
                      ? "rounded-[2rem] border border-slate-900 bg-slate-900 p-6 text-white shadow-lg shadow-slate-900/10"
                      : "rounded-[2rem] border border-slate-200/80 bg-white/85 p-6 shadow-sm transition hover:border-slate-300 hover:bg-white"}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedFolderId(folder.id)}
                      className="block w-full text-left"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className={selected ? "text-sm text-white/70" : "text-sm text-slate-500"}>Folder</p>
                          <h3 className="mt-3 text-2xl font-semibold tracking-tight">{folder.name}</h3>
                        </div>
                        <span className={selected
                          ? "rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white"
                          : "rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-slate-500"}
                        >
                          {folderTrips.length}
                        </span>
                      </div>
                      <div className={selected ? "mt-4 flex gap-4 text-sm text-white/70" : "mt-4 flex gap-4 text-sm text-slate-500"}>
                        <span>{activeCount} active</span>
                        <span>{pastCount} past</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteFolder(folder)}
                      disabled={deletingFolderId === folder.id}
                      className={selected
                        ? "mt-5 text-sm font-semibold text-rose-100 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                        : "mt-5 text-sm font-semibold text-rose-600 transition hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"}
                    >
                      {deletingFolderId === folder.id ? "Deleting..." : "Delete"}
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <nav className="grid gap-2 rounded-[2rem] border border-slate-200/80 bg-white/90 p-2 shadow-sm sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setActiveView("active")}
            className={activeView === "active"
              ? "rounded-[1.5rem] bg-slate-900 px-5 py-3 text-left text-sm font-semibold text-white"
              : "rounded-[1.5rem] px-5 py-3 text-left text-sm font-semibold text-slate-600 transition hover:bg-stone-100 hover:text-slate-900"}
          >
            Active Trips <span className="ml-2 opacity-70">{activeTrips.length}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveView("past")}
            className={activeView === "past"
              ? "rounded-[1.5rem] bg-slate-900 px-5 py-3 text-left text-sm font-semibold text-white"
              : "rounded-[1.5rem] px-5 py-3 text-left text-sm font-semibold text-slate-600 transition hover:bg-stone-100 hover:text-slate-900"}
          >
            Past Trips <span className="ml-2 opacity-70">{pastTrips.length}</span>
          </button>
        </nav>

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
              className="mt-8 inline-flex rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold !text-white shadow-lg shadow-slate-900/10 transition hover:bg-slate-800"
            >
              Plan your first trip
            </Link>
          </section>
        ) : activeView === "active" ? (
          renderTripSection(
            selectedTripsLabel,
            "Trips you are still planning or keeping active.",
            activeTrips,
            selectedFolderId === "all"
              ? "Your in-progress trips and open itineraries will appear here."
              : "No active trips are assigned here yet."
          )
        ) : (
          renderPastArchive()
        )}
      </div>
      {completionTrip && (
        <TripCompletionModal
          trip={completionTrip}
          completing={completingId === completionTrip.id}
          sharing={sharingId === completionTrip.id}
          onClose={closeCompleteTrip}
          onComplete={handleCompleteTrip}
          onShare={handleShareCompletedTrip}
        />
      )}
    </AppShell>
  );
}
