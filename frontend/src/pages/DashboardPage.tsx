import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { createFolder, deleteFolder, listFolders } from "../api/folders";
import { completeTrip, deleteTrip, listTrips, setTripFolder, setTripShared } from "../api/trips";
import AppShell from "../components/AppShell";
import TripCompletionModal from "../components/TripCompletionModal";
import { getTripHeroImageUrl } from "../tripImages";
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
    const menuItemClass = "flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-medium text-[var(--ws-muted)] transition hover:bg-[var(--ws-cream)] hover:text-[var(--ws-ink)] disabled:cursor-not-allowed disabled:opacity-60";
    const dangerItemClass = "flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-semibold text-[var(--ws-orange)] transition hover:bg-[var(--ws-cream)] disabled:cursor-not-allowed disabled:opacity-60";

    return (
      <div className="mt-5 flex items-center gap-3">
        <Link
          to={`/trips/${trip.id}`}
          className="ws-btn-primary flex-1 px-4 py-2.5 text-sm"
        >
          View itinerary
        </Link>
        <div className="relative" data-trip-actions>
          <button
            type="button"
            aria-label={`Trip actions for ${trip.title}`}
            aria-expanded={isOpen}
            onClick={() => setOpenTripActionsId((current) => (current === trip.id ? null : trip.id))}
            className="inline-flex size-10 items-center justify-center rounded-full border border-[var(--ws-line)] bg-[#fffdf8] text-lg font-semibold leading-none text-[var(--ws-muted)] shadow-sm transition hover:border-[rgba(20,19,15,0.24)] hover:text-[var(--ws-ink)]"
          >
            ⋯
          </button>

          {isOpen && (
            <div className="absolute right-0 bottom-12 z-20 w-64 rounded-[1.5rem] border border-[var(--ws-line)] bg-[#fffdf8] p-2 shadow-xl shadow-stone-900/10">
              <div className="px-3 py-2">
                <p className="ws-mono text-[rgba(87,84,74,0.7)]">Move to folder</p>
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
                {(trip.folder_id ?? null) === null && <span className="text-xs text-[rgba(87,84,74,0.65)]">Current</span>}
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
                  {trip.folder_id === folder.id && <span className="text-xs text-[rgba(87,84,74,0.65)]">Current</span>}
                </button>
              ))}

              <div className="my-2 h-px bg-[var(--ws-line-soft)]" />

              {trip.status !== "completed" && (
                <button
                  type="button"
                  onClick={() => {
                    setOpenTripActionsId(null);
                    openCompleteTrip(trip);
                  }}
                  disabled={completingId === trip.id}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-semibold text-[var(--ws-green)] transition hover:bg-[var(--ws-green-tint)] hover:text-[var(--ws-green)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {completingId === trip.id ? "Completing..." : "Complete trip"}
                </button>
              )}
              {trip.status === "completed" && (
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
              )}

              <div className="my-2 h-px bg-[var(--ws-line-soft)]" />

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
      <section className="ws-surface p-6 sm:p-7">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="ws-mono text-[var(--ws-muted)]">{label}</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-[var(--ws-ink)]">{title}</h2>
          </div>
          <span className="ws-pill px-4 py-2 text-sm font-medium">
            {items.length}
          </span>
        </div>

        {items.length === 0 ? (
          <div className="mt-6 rounded-[1.75rem] border border-dashed border-[var(--ws-line)] bg-[rgba(255,244,239,0.6)] px-6 py-10 text-center">
            <p className="ws-mono text-[var(--ws-muted)]">Nothing here yet</p>
            <p className="mt-3 text-base leading-7 text-[var(--ws-muted)]">{emptyLabel}</p>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map((trip) => {
              const dayCount = trip.itinerary?.days?.length ?? 0;
              const heroImageUrl = getTripHeroImageUrl(trip.itinerary);

              return (
                <article
                  key={trip.id}
                  className={heroImageUrl
                    ? "flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-[var(--ws-line)] bg-[#fffdf8] transition hover:border-[rgba(20,19,15,0.24)]"
                    : "flex h-full flex-col rounded-[1.75rem] border border-[var(--ws-line)] bg-[rgba(255,244,239,0.6)] px-5 py-5 transition hover:border-[rgba(20,19,15,0.24)] hover:bg-[#fffdf8]"}
                >
                  {heroImageUrl && (
                    <img
                      src={heroImageUrl}
                      alt={trip.destination}
                      className="h-44 w-full object-cover"
                      loading="lazy"
                    />
                  )}
                  <div className={heroImageUrl ? "flex flex-1 flex-col px-5 py-5" : "flex flex-1 flex-col"}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[var(--ws-muted)]">{trip.destination}</p>
                        <p className="mt-2 line-clamp-2 text-xl font-semibold tracking-[-0.02em] text-[var(--ws-ink)]">{trip.title}</p>
                      </div>
                      <span className="shrink-0 whitespace-nowrap rounded-full bg-white px-3 py-1 text-xs font-medium text-[var(--ws-muted)] shadow-sm">
                        {formatDate(trip.created_at)}
                      </span>
                    </div>

                    <p className="mb-5 mt-4 line-clamp-3 text-sm leading-6 text-[var(--ws-muted)]">
                      {trip.description || "Saved from your recommendation flow and ready to revisit."}
                    </p>

                    <div className="mt-auto grid grid-cols-2 gap-3 rounded-[1.5rem] bg-white/80 p-4 text-sm text-[var(--ws-muted)]">
                      <div>
                        <p className="ws-mono text-[rgba(87,84,74,0.7)]">Days</p>
                        <p className="mt-2 font-medium text-[var(--ws-ink)]">{dayCount || "-"}</p>
                      </div>
                      <div>
                        <p className="ws-mono text-[rgba(87,84,74,0.7)]">Status</p>
                        <p className="mt-2 font-medium capitalize text-[var(--ws-ink)]">{trip.status}</p>
                      </div>
                      <div>
                        <p className="ws-mono text-[rgba(87,84,74,0.7)]">Community</p>
                        <p className="mt-2 font-medium text-[var(--ws-ink)]">{trip.shared_at ? "Shared" : "Private"}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="ws-mono text-[rgba(87,84,74,0.7)]">Estimated total</p>
                        <p className="mt-2 font-medium text-[var(--ws-ink)]">
                          {formatMoney(trip.itinerary?.estimated_total, trip.itinerary?.currency)}
                        </p>
                      </div>
                    </div>

                    {renderTripActions(trip)}
                  </div>
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
      <section className="ws-surface p-6 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="ws-mono text-[var(--ws-muted)]">{selectedTripsLabel}</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.02em] text-[var(--ws-ink)]">Past Trips Archive</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--ws-muted)]">
              Revisit completed itineraries, share the ones worth recommending, and use past plans as a shortcut for your next trip.
            </p>
          </div>
          <div className="grid min-w-full gap-3 sm:grid-cols-3 lg:min-w-[360px]">
            <div className="ws-chip-card px-4 py-4">
              <p className="ws-mono text-[rgba(87,84,74,0.7)]">Completed</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--ws-ink)]">{pastTrips.length}</p>
            </div>
            <div className="ws-chip-card ws-chip-card-yellow px-4 py-4">
              <p className="ws-mono text-[rgba(87,84,74,0.7)]">Trip days</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--ws-ink)]">{totalPastDays}</p>
            </div>
            <div className="ws-chip-card ws-chip-card-green-soft px-4 py-4">
              <p className="ws-mono text-[rgba(87,84,74,0.7)]">Shared</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--ws-ink)]">{sharedPastTrips}</p>
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
            className="ws-input min-w-0 rounded-full px-5 py-3 text-sm transition"
          />
          <label className="sr-only" htmlFor="past-trip-sharing">Filter by sharing</label>
          <select
            id="past-trip-sharing"
            value={pastSharedFilter}
            onChange={(event) => setPastSharedFilter(event.target.value as "all" | "shared" | "private")}
            className="ws-input rounded-full px-5 py-3 text-sm font-medium transition"
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
            className="ws-input rounded-full px-5 py-3 text-sm font-medium transition"
          >
            <option value="recent">Most recent</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>

        {pastTrips.length === 0 ? (
          <div className="mt-6 rounded-[1.75rem] border border-dashed border-[var(--ws-line)] bg-[rgba(255,244,239,0.6)] px-6 py-10 text-center">
            <p className="ws-mono text-[var(--ws-muted)]">No completed trips yet</p>
            <p className="mt-3 text-base leading-7 text-[var(--ws-muted)]">
              Mark a trip as complete to start building your archive of repeatable itineraries.
            </p>
          </div>
        ) : pastArchiveTrips.length === 0 ? (
          <div className="mt-6 rounded-[1.75rem] border border-dashed border-[var(--ws-line)] bg-[rgba(255,244,239,0.6)] px-6 py-10 text-center">
            <p className="ws-mono text-[var(--ws-muted)]">No matches</p>
            <p className="mt-3 text-base leading-7 text-[var(--ws-muted)]">
              Try a different search term or visibility filter.
            </p>
          </div>
        ) : (
          <div className="mt-8 space-y-8">
            {pastArchiveGroups.map((group) => (
              <div key={group.label}>
                <div className="mb-4 flex items-center gap-4">
                  <h3 className="ws-mono text-[rgba(87,84,74,0.7)]">{group.label}</h3>
                  <div className="h-px flex-1 bg-[var(--ws-line)]" />
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {group.items.map((trip) => {
                    const dayCount = trip.itinerary?.days?.length ?? 0;
                    const heroImageUrl = getTripHeroImageUrl(trip.itinerary);

                    return (
                      <article
                        key={trip.id}
                        className={heroImageUrl
                          ? "flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-[var(--ws-line)] bg-[#fffdf8] transition hover:border-[rgba(20,19,15,0.24)]"
                          : "flex h-full flex-col rounded-[1.75rem] border border-[var(--ws-line)] bg-[rgba(255,244,239,0.6)] px-5 py-5 transition hover:border-[rgba(20,19,15,0.24)] hover:bg-[#fffdf8]"}
                      >
                        {heroImageUrl && (
                          <img
                            src={heroImageUrl}
                            alt={trip.destination}
                            className="h-44 w-full object-cover"
                            loading="lazy"
                          />
                        )}
                        <div className={heroImageUrl ? "flex flex-1 flex-col px-5 py-5" : "flex flex-1 flex-col"}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-[var(--ws-muted)]">{trip.destination}</p>
                              <h3 className="mt-2 line-clamp-2 text-xl font-semibold tracking-[-0.02em] text-[var(--ws-ink)]">{trip.title}</h3>
                            </div>
                            <span className="shrink-0 whitespace-nowrap rounded-full bg-white px-3 py-1 text-xs font-medium text-[var(--ws-muted)] shadow-sm">
                              {formatDate(trip.created_at)}
                            </span>
                          </div>

                          <p className="mt-4 line-clamp-2 text-sm leading-6 text-[var(--ws-muted)]">
                            {trip.description || "Saved from your recommendation flow and ready to revisit."}
                          </p>

                          <div className="mt-auto flex flex-wrap gap-2 pt-5 text-sm text-[var(--ws-muted)]">
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
                        </div>
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
        <Link
          to="/?plan=1"
          className="ws-btn-primary px-5 py-3 text-sm"
        >
          Plan a trip
        </Link>
      }
    >
      <div className="space-y-4">
        <section className="ws-surface p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="ws-mono text-[var(--ws-muted)]">Folders</p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-[var(--ws-ink)]">
                Filter active and past trips by collection.
              </h2>
            </div>
            <div className="sm:self-end">
              <button
                type="button"
                onClick={() => setIsCreateFolderOpen((open) => !open)}
                className="ws-btn-secondary px-5 py-3 text-sm"
              >
                New folder
              </button>
            </div>
          </div>

          {isCreateFolderOpen && (
            <form
              onSubmit={handleCreateFolder}
              className="mt-4 rounded-[1.5rem] border border-[var(--ws-line)] bg-[#fffdf8] p-4"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
                <div className="flex-1">
                  <label className="text-sm font-medium text-[var(--ws-muted)]" htmlFor="folder-name">
                    Folder name
                  </label>
                  <input
                    id="folder-name"
                    value={folderName}
                    onChange={(event) => setFolderName(event.target.value)}
                    placeholder="Weekend escapes"
                    className="ws-input mt-2 w-full rounded-2xl px-4 py-3 text-sm transition"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-sm font-medium text-[var(--ws-muted)]" htmlFor="folder-description">
                    Description <span className="text-[rgba(87,84,74,0.65)]">optional</span>
                  </label>
                  <input
                    id="folder-description"
                    value={folderDescription}
                    onChange={(event) => setFolderDescription(event.target.value)}
                    placeholder="Ideas for quick train trips"
                    className="ws-input mt-2 w-full rounded-2xl px-4 py-3 text-sm transition"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsCreateFolderOpen(false)}
                    className="rounded-full px-5 py-3 text-sm font-semibold text-[var(--ws-muted)] transition hover:text-[var(--ws-ink)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingFolder}
                    className="ws-btn-primary px-5 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {creatingFolder ? "Creating..." : "Create"}
                  </button>
                </div>
              </div>
            </form>
          )}

          {loading ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="h-28 animate-pulse rounded-[1.5rem] bg-[var(--ws-cream)]" />
              <div className="h-28 animate-pulse rounded-[1.5rem] bg-[var(--ws-cream)]" />
              <div className="h-28 animate-pulse rounded-[1.5rem] bg-[var(--ws-cream)]" />
              <div className="h-28 animate-pulse rounded-[1.5rem] bg-[var(--ws-cream)]" />
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <button
                type="button"
                onClick={() => setSelectedFolderId("all")}
                className={selectedFolderId === "all"
                  ? "ws-surface-dark p-4 text-left shadow-lg shadow-stone-900/10"
                  : "ws-surface-flat p-4 text-left shadow-sm transition hover:border-[rgba(20,19,15,0.24)] hover:bg-white"}
              >
                <p className={selectedFolderId === "all" ? "text-sm text-white/70" : "text-sm text-[var(--ws-muted)]"}>All collections</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight">{trips.length}</p>
                <p className={selectedFolderId === "all" ? "mt-1 text-sm text-white/70" : "mt-1 text-sm text-[var(--ws-muted)]"}>
                  Every active and past trip.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSelectedFolderId("unfiled")}
                className={selectedFolderId === "unfiled"
                  ? "ws-surface-dark p-4 text-left shadow-lg shadow-stone-900/10"
                  : "ws-surface-flat p-4 text-left shadow-sm transition hover:border-[rgba(20,19,15,0.24)] hover:bg-white"}
              >
                <p className={selectedFolderId === "unfiled" ? "text-sm text-white/70" : "text-sm text-[var(--ws-muted)]"}>Unfiled</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight">{unfiledTripsCount}</p>
                <p className={selectedFolderId === "unfiled" ? "mt-1 text-sm text-white/70" : "mt-1 text-sm text-[var(--ws-muted)]"}>
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
                      ? "ws-surface-dark p-4 shadow-lg shadow-stone-900/10"
                      : "ws-surface-flat p-4 shadow-sm transition hover:border-[rgba(20,19,15,0.24)] hover:bg-white"}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedFolderId(folder.id)}
                      className="block w-full text-left"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className={selected ? "text-sm text-white/70" : "text-sm text-[var(--ws-muted)]"}>Folder</p>
                          <h3 className="mt-2 text-xl font-semibold tracking-tight">{folder.name}</h3>
                        </div>
                        <span className={selected
                          ? "rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white"
                          : "rounded-full bg-[var(--ws-cream)] px-3 py-1 text-xs font-medium text-[var(--ws-muted)]"}
                        >
                          {folderTrips.length}
                        </span>
                      </div>
                      <div className={selected ? "mt-3 flex gap-4 text-sm text-white/70" : "mt-3 flex gap-4 text-sm text-[var(--ws-muted)]"}>
                        <span>{activeCount} active</span>
                        <span>{pastCount} past</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteFolder(folder)}
                      disabled={deletingFolderId === folder.id}
                      className={selected
                        ? "mt-4 text-sm font-semibold text-[var(--ws-yellow)] transition hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                        : "mt-4 text-sm font-semibold text-[var(--ws-orange)] transition hover:text-[var(--ws-ink)] disabled:cursor-not-allowed disabled:opacity-60"}
                    >
                      {deletingFolderId === folder.id ? "Deleting..." : "Delete"}
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <nav className="grid gap-2 rounded-[2rem] border border-[var(--ws-line)] bg-[#fffdf8]/90 p-2 shadow-sm sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setActiveView("active")}
            className={activeView === "active"
              ? "rounded-[1.5rem] bg-[var(--ws-ink)] px-5 py-3 text-left text-sm font-semibold text-[var(--ws-bg)]"
              : "rounded-[1.5rem] px-5 py-3 text-left text-sm font-semibold text-[var(--ws-muted)] transition hover:bg-[var(--ws-cream)] hover:text-[var(--ws-ink)]"}
          >
            Active Trips <span className="ml-2 opacity-70">{activeTrips.length}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveView("past")}
            className={activeView === "past"
              ? "rounded-[1.5rem] bg-[var(--ws-ink)] px-5 py-3 text-left text-sm font-semibold text-[var(--ws-bg)]"
              : "rounded-[1.5rem] px-5 py-3 text-left text-sm font-semibold text-[var(--ws-muted)] transition hover:bg-[var(--ws-cream)] hover:text-[var(--ws-ink)]"}
          >
            Past Trips <span className="ml-2 opacity-70">{pastTrips.length}</span>
          </button>
        </nav>

        {error && (
          <p className="rounded-2xl border border-[rgba(228,87,46,0.24)] bg-[var(--ws-cream)] px-4 py-3 text-sm text-[var(--ws-orange)]">
            {error}
          </p>
        )}

        {loading ? (
          <div className="grid gap-6 xl:grid-cols-2">
            <div className="h-80 animate-pulse rounded-[2rem] bg-white/70 shadow-sm" />
            <div className="h-80 animate-pulse rounded-[2rem] bg-white/70 shadow-sm" />
          </div>
        ) : trips.length === 0 ? (
          <section className="rounded-[2.5rem] border border-dashed border-[var(--ws-line)] bg-[#fffdf8]/60 px-6 py-14 text-center shadow-sm sm:px-10">
            <p className="ws-mono text-[var(--ws-muted)]">Ready to start</p>
            <h2 className="ws-display mt-4 text-3xl">
              Your trip history will build from here.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-[var(--ws-muted)]">
              Generate a tailored itinerary, save the one that fits best, and come back to it anytime.
            </p>
            <Link
              to="/?plan=1"
              className="ws-btn-primary mt-8 px-6 py-3 text-sm"
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
