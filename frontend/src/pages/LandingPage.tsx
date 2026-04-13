import { Link } from "react-router-dom";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(254,226,226,0.9),_transparent_28%),linear-gradient(180deg,#fcfbf8_0%,#f2ecdf_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-7xl overflow-hidden rounded-[2.5rem] border border-white/70 bg-[#fcfbf8]/80 shadow-2xl shadow-stone-200/50 backdrop-blur lg:grid-cols-[1.08fr_0.92fr]">
        <section className="bg-slate-900 px-8 py-10 text-white sm:px-10 lg:px-12 lg:py-14">
          <p className="text-sm font-semibold tracking-[0.24em] text-white/65 uppercase">WellSpent</p>
          <h1 className="mt-8 max-w-xl text-5xl font-semibold tracking-tight lg:text-6xl">
            Plan Swiss trips around the way you actually like to travel.
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-white/72">
            Save your travel profile once, generate itinerary ideas faster, and keep every promising route in one place.
          </p>

          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            <div className="rounded-[2rem] border border-white/10 bg-white/8 p-5">
              <p className="text-sm font-medium text-white/65">Home</p>
              <p className="mt-3 text-lg font-semibold">Jump back into planning or revisit recent trips.</p>
            </div>
            <div className="rounded-[2rem] border border-white/10 bg-white/8 p-5">
              <p className="text-sm font-medium text-white/65">Plan</p>
              <p className="mt-3 text-lg font-semibold">Turn dates, preferences, and notes into a saved itinerary.</p>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center px-6 py-10 sm:px-10">
          <div className="w-full max-w-md">
            <p className="text-sm font-semibold tracking-[0.24em] text-slate-500 uppercase">Start here</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-tight text-slate-900">
              Sign in to your trip hub.
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Use the new in-app home to jump between planning, saved itineraries, and profile settings.
            </p>

            <div className="mt-8 flex flex-col gap-3">
              <Link
                to="/login"
                className="inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition hover:bg-slate-800"
              >
                Sign in
              </Link>
              <Link
                to="/register"
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
              >
                Create account
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
