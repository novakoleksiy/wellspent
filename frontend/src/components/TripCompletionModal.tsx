import { useState, type ChangeEvent, type FormEvent } from "react";
import type { TripCompleteRequest, TripOut } from "../types";

const MAX_IMAGE_FILES = 10;
const MAX_IMAGE_FILE_SIZE_BYTES = 5 * 1024 * 1024;

interface TripCompletionModalProps {
  trip: TripOut;
  completing: boolean;
  sharing: boolean;
  onClose: () => void;
  onComplete: (body: TripCompleteRequest) => Promise<TripOut>;
  onShare: (trip: TripOut) => Promise<TripOut>;
}

export default function TripCompletionModal({
  trip,
  completing,
  sharing,
  onClose,
  onComplete,
  onShare,
}: TripCompletionModalProps) {
  const [activeTrip, setActiveTrip] = useState(trip);
  const [rating, setRating] = useState(trip.completion_rating ?? 0);
  const [comment, setComment] = useState(trip.completion_comment ?? "");
  const [images, setImages] = useState<File[]>([]);
  const [fileError, setFileError] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextImages = Array.from(event.target.files ?? []);
    const oversized = nextImages.find((image) => image.size > MAX_IMAGE_FILE_SIZE_BYTES);

    if (nextImages.length > MAX_IMAGE_FILES) {
      setImages([]);
      setFileError(`Select up to ${MAX_IMAGE_FILES} images.`);
      event.target.value = "";
      return;
    }

    if (oversized) {
      setImages([]);
      setFileError(`${oversized.name} is larger than 5 MB.`);
      event.target.value = "";
      return;
    }

    setFileError("");
    setImages(nextImages);
  };

  const handleComplete = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (fileError) {
      return;
    }

    const trimmedComment = comment.trim();
    const updatedTrip = await onComplete({
      rating,
      comment: trimmedComment || null,
      image_urls: activeTrip.completion_image_urls,
    });
    setActiveTrip(updatedTrip);
    setConfirmed(true);
  };

  const handleShare = async () => {
    await onShare(activeTrip);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-950/20 sm:p-7">
        {confirmed ? (
          <div>
            <p className="text-sm font-semibold tracking-[0.18em] text-emerald-600 uppercase">Trip completed</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
              {activeTrip.title} is now in your past trips.
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Your rating and notes were saved. You can keep this private or share the itinerary with the community.
            </p>

            <div className="mt-6 rounded-[1.5rem] bg-stone-50 p-4">
              <p className="text-sm font-medium text-slate-600">Your rating</p>
              <p className="mt-2 text-2xl text-amber-500">
                {rating === 0 ? "No stars" : `${"★".repeat(rating)}${"☆".repeat(5 - rating)}`}
              </p>
              {comment.trim() && <p className="mt-3 text-sm leading-6 text-slate-600">{comment.trim()}</p>}
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full px-5 py-3 text-sm font-semibold text-slate-500 transition hover:text-slate-900"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleShare}
                disabled={sharing || Boolean(activeTrip.shared_at)}
                className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {sharing ? "Sharing..." : activeTrip.shared_at ? "Shared with community" : "Share with community"}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleComplete}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold tracking-[0.18em] text-slate-400 uppercase">Complete trip</p>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">{activeTrip.title}</h2>
                <p className="mt-2 text-sm text-slate-500">{activeTrip.destination}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex size-10 items-center justify-center rounded-full border border-slate-200 text-xl leading-none text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
                aria-label="Close completion dialog"
              >
                ×
              </button>
            </div>

            <div className="mt-6">
              <p className="text-sm font-medium text-slate-700">Rate this trip</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {[0, 1, 2, 3, 4, 5].map((nextRating) => (
                  <button
                    key={nextRating}
                    type="button"
                    onClick={() => setRating(nextRating)}
                    className={rating === nextRating
                      ? "rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-700 ring-1 ring-amber-300"
                      : "rounded-full bg-stone-100 px-4 py-2 text-sm font-semibold text-slate-500 transition hover:bg-amber-50 hover:text-amber-700"}
                  >
                    {nextRating === 0 ? "0 stars" : `${nextRating} ★`}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <label className="text-sm font-medium text-slate-700" htmlFor="completion-comment">
                Comment <span className="text-slate-400">optional</span>
              </label>
              <textarea
                id="completion-comment"
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                rows={4}
                placeholder="What should you remember about this trip?"
                className="mt-2 w-full resize-none rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400"
              />
            </div>

            <div className="mt-5">
              <label className="text-sm font-medium text-slate-700" htmlFor="completion-images">
                Attach images <span className="text-slate-400">optional</span>
              </label>
              <input
                id="completion-images"
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageChange}
                className="mt-2 block w-full rounded-3xl border border-dashed border-slate-300 bg-stone-50 px-4 py-4 text-sm text-slate-500 file:mr-4 file:rounded-full file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
              />
              <p className="mt-2 text-xs leading-5 text-slate-400">
                Select up to 10 images. Each file must be 5 MB or smaller. Image upload storage is not enabled yet, so selected files are shown here but not saved.
              </p>
              {fileError && <p className="mt-2 text-xs font-medium text-rose-600">{fileError}</p>}
              {images.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {images.map((image) => (
                    <span key={`${image.name}-${image.size}`} className="rounded-full bg-stone-100 px-3 py-1.5 text-xs font-medium text-slate-600">
                      {image.name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full px-5 py-3 text-sm font-semibold text-slate-500 transition hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={completing || Boolean(fileError)}
                className="rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/10 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {completing ? "Completing..." : "Complete"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
