import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { joinWaitlist } from "../api/waitlist";
import "./landing.css";

async function submitWaitlist(
  event: FormEvent<HTMLFormElement>,
  email: string,
  setError: (value: string) => void,
  setLoading: (value: boolean) => void,
  setSubmitted: (value: boolean) => void,
  setShowConfirmation: (value: boolean) => void,
) {
  event.preventDefault();

  setError("");
  setLoading(true);

  try {
    await joinWaitlist({ email });
    setSubmitted(true);
    setShowConfirmation(true);
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes("already on the waitlist")) {
      setError("You're already on the list - we'll reach out soon!");
    } else {
      setError(error instanceof Error ? error.message : "Something went wrong");
    }
  } finally {
    setLoading(false);
  }
}

export default function LandingPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const waitlistInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = "Wellspent - Day trips, ready in two minutes";
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    void submitWaitlist(event, email, setError, setLoading, setSubmitted, setShowConfirmation);
  };

  const focusWaitlistInput = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    waitlistInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });

    window.setTimeout(() => {
      waitlistInputRef.current?.focus({ preventScroll: true });
    }, 450);
  };

  return (
    <div className="landing-page">
      {showConfirmation && (
        <div className="confirmation-overlay" role="dialog" aria-modal="true" aria-labelledby="waitlist-confirmation-title">
          <div className="confirmation-card">
            <p className="confirmation-eyebrow">You&apos;re in</p>
            <h2 id="waitlist-confirmation-title">Thanks for joining the waitlist.</h2>
            <p>We&apos;ll email you as soon as Wellspent is ready.</p>
            <button className="btn" type="button" onClick={() => setShowConfirmation(false)}>
              Continue browsing
            </button>
          </div>
        </div>
      )}
      <header className="nav">
        <div className="nav-inner">
          <img className="nav-logo" src="/landing/logo.png" alt="Wellspent" />
          <div className="nav-right">
            <span className="mono">Winterthur · CH</span>
            <a className="btn" href="#waitlist" onClick={focusWaitlistInput}>
              Join the waitlist
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="hero container">
          <div className="hero-meta">
            <span className="mono">Launching soon</span>
          </div>

          <h1 className="hero-title">
            <span className="title-desktop">
              Your next <span className="italic">well spent</span>
              <br />
              trip, planned in <span className="accent">two&nbsp;minutes</span>.
            </span>
            <span className="title-mobile">
              Your next 
              <br />
              <span className="italic">well spent</span> trip,
              <br />
              planned in
              <br />
              <span className="accent">two&nbsp;minutes</span>
            </span>
          </h1>

          <div className="hero-grid">
            <div className="hero-copy">
              <div className="polaroids" aria-hidden="true">
                <div className="polaroid">
                  <img src="/landing/polaroid_1.png" alt="" />
                </div>
                <div className="polaroid">
                  <img src="/landing/polaroid_2.png" alt="" />
                </div>
                <div className="polaroid">
                  <img src="/landing/polaroid_3.png" alt="" />
                </div>
              </div>
              <p>
                Tell us your time, budget, mood, and who you&apos;re with. We build a full day trip with real train
                connections, local stops, food worth finding, and the detours you&apos;d never plan yourself.
              </p>
              {submitted ? (
                <p className="hero-foot">Thanks for joining. We&apos;ll email you when Wellspent is ready.</p>
              ) : (
                <form className="form" id="waitlist" onSubmit={handleSubmit}>
                  <input
                    ref={waitlistInputRef}
                    type="email"
                    placeholder="you@example.ch"
                    value={email}
                    onChange={event => setEmail(event.target.value)}
                    required
                  />
                  <button className="btn" type="submit" disabled={loading}>
                    {loading ? "Joining..." : "Join the waitlist →"}
                  </button>
                </form>
              )}
              {error && <p className="hero-foot">{error}</p>}
              <p className="hero-foot">Be one of the first. Early members get priority access at launch.</p>
            </div>

            <div className="hero-visual">
              <span className="chip chip-dark">Live SBB · pl. 32</span>
              <img className="hero-phone" src="/landing/phone.png" alt="Wellspent app preview" />
              <span className="chip chip-yellow">leaving in 5 min</span>
              <span className="chip chip-pale">CHF 42 · Lugano</span>
            </div>
          </div>
        </section>

        <div className="marquee">
          <div className="marquee-track">
            <span>Real SBB connections</span>
            <span className="star">✦</span>
            <span>Mood-first planning</span>
            <span className="star">✦</span>
            <span>Chat to edit anything</span>
            <span className="star">✦</span>
            <span>Solo · Couple · Group</span>
            <span className="star">✦</span>
            <span>Built in Winterthur</span>
            <span className="star">✦</span>
            <span>Real SBB connections</span>
            <span className="star">✦</span>
            <span>Mood-first planning</span>
            <span className="star">✦</span>
            <span>Chat to edit anything</span>
            <span className="star">✦</span>
            <span>Solo · Paare · Gruppen</span>
            <span className="star">✦</span>
            <span>Built in Winterthur</span>
            <span className="star">✦</span>
          </div>
        </div>

        <section className="section">
          <div className="container">
            <div className="section-lead">
              <h2 className="section-title">
                Four questions. A full day trip built for <span className="italic">you</span>.
              </h2>
              <p>
                No endless tabs, no forum rabbit-holes. You answer four small questions and we assemble a day that
                actually fits you.
              </p>
            </div>

            <div className="cards">
              <div className="card">
                <span className="mono eyebrow">01 / Inputs</span>
                <h3>
                  Tell us <span className="italic">four things</span>.
                </h3>
                <div className="inputs">
                  <div className="chip-card">
                    <div>
                      <div className="chip-num">01</div>
                      <div className="chip-label">Time</div>
                    </div>
                    <div className="chip-values">6 h · 9 h · whole day</div>
                  </div>
                  <div className="chip-card">
                    <div>
                      <div className="chip-num">02</div>
                      <div className="chip-label">Budget</div>
                    </div>
                    <div className="chip-values">CHF 40 – 250</div>
                  </div>
                  <div className="chip-card">
                    <div>
                      <div className="chip-num">03</div>
                      <div className="chip-label">Mood</div>
                    </div>
                    <div className="chip-values">
                      culture · nature
                      <br />
                      food · slow
                    </div>
                  </div>
                  <div className="chip-card">
                    <div>
                      <div className="chip-num">04</div>
                      <div className="chip-label">Company</div>
                    </div>
                    <div className="chip-values">
                      solo · partner
                      <br />
                      small group · +kids
                    </div>
                  </div>
                </div>
                <p className="card-footer">That&apos;s it. No profile, no long survey.</p>
              </div>

              <div className="card card-orange">
                <span className="mono eyebrow">02 / Output</span>
                <h3>
                  One day.
                  <br />
                  Ready to <span className="italic">go</span>.
                </h3>
                <p style={{ opacity: 0.9 }}>Under two minutes from tap to trip.</p>
              </div>
            </div>

            <div className="duet">
              <div className="card card-dark">
                <span className="mono eyebrow" style={{ color: "var(--yellow)", opacity: 0.8 }}>
                  Specimen · Zürich → Appenzell · Nature · 2 pax
                </span>
                <h3>
                  An afternoon in <span className="italic">Appenzell</span>.
                </h3>
                <div className="itinerary">
                  <div className="row">
                    <div className="time">08:34</div>
                    <div>
                      <p className="main">Zürich HB → Gossau SG</p>
                      <p className="sub">IC 1 · change at Gossau</p>
                      <div className="pl">Pl. 32</div>
                    </div>
                  </div>
                  <div className="row">
                    <div className="time">09:48</div>
                    <div>
                      <p className="main">Appenzeller Bahn to Wasserauen</p>
                      <p className="sub">Scenic route · 42 min</p>
                      <div className="pl">Pl. 4</div>
                    </div>
                  </div>
                  <div className="row">
                    <div className="time">10:40</div>
                    <div>
                      <p className="main">Ebenalp cable car + Aescher trail</p>
                      <p className="sub">2 h loop · easy</p>
                      <div className="pl">—</div>
                    </div>
                  </div>
                  <div className="row">
                    <div className="time">13:10</div>
                    <div>
                      <p className="main">Berggasthaus Aescher · cheese board</p>
                      <p className="sub">Partner deal · 15% off</p>
                      <div className="pl">★</div>
                    </div>
                  </div>
                  <div className="row">
                    <div className="time">15:55</div>
                    <div>
                      <p className="main">Return via Wasserauen → Zürich HB</p>
                      <p className="sub">Arrive 18:22</p>
                      <div className="pl">Pl. 6</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card card-yellow">
                <span className="mono eyebrow">Mood-first</span>
                <h3>
                  Matched to how you want to <span className="italic">feel</span>.
                </h3>
                <p>Not a list of tourist spots. A day shaped around slow, sharp, hungry, or still.</p>
              </div>
            </div>

            <div className="triple">
              <div className="card card-green">
                <span className="mono eyebrow" style={{ color: "var(--green-tint)", opacity: 0.85 }}>
                  Chat to edit
                </span>
                <h3>
                  Refine as you <span className="italic">go</span>.
                </h3>
                <p>
                  Wellspent suggests tweaks based on your plan. Swap the pace, cut the cost, go easier on the walking.
                  One change, whole day updated.
                </p>
              </div>
              <div className="card card-navy">
                <span className="mono eyebrow" style={{ color: "var(--navy-tint)", opacity: 0.85 }}>
                  Live data
                </span>
                <h3>
                  Real trains, real platforms, <span className="italic">real time</span>.
                </h3>
                <p>
                  Every itinerary runs on live transport data. If your 09:04 is cancelled, we re-plan before you
                  notice.
                </p>
              </div>
              <div className="card">
                <span className="mono eyebrow">Group-ready</span>
                <h3>
                  Solo, <span className="italic">two</span>, or a small crew.
                </h3>
                <p>Plans scale to group size: menus that work for six, walks that work for one.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <div className="section-lead">
              <h2 className="section-title">
                Ready before you finish your <span className="italic">coffee</span>.
              </h2>
              <p>
                We do the part of trip planning that nobody enjoys - timetables, opening hours, reservations - and
                leave you the part that&apos;s actually the trip.
              </p>
            </div>

            <div className="steps">
              <div className="step">
                <div className="step-num italic">01</div>
                <h4>Tell us the day.</h4>
                <p>Four taps: time, budget, vibe, company. No sign-up to try it.</p>
                <div className="step-polaroid" aria-hidden="true">
                  <img src="/landing/polaroid_4.png" alt="" />
                </div>
              </div>
              <div className="step">
                <div className="step-num italic">02</div>
                <h4>Read the plan.</h4>
                <p>Train times, platforms, a handful of stops with notes from people who actually live there.</p>
                <div className="step-polaroid" aria-hidden="true">
                  <img src="/landing/polaroid_5.png" alt="" />
                </div>
              </div>
              <div className="step">
                <div className="step-num italic">03</div>
                <h4>Go.</h4>
                <p>Chat to change anything en route. Partner deals apply automatically at the cafe, museum, or workshop.</p>
                <div className="step-polaroid" aria-hidden="true">
                  <img src="/landing/polaroid_6.png" alt="" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <h2 className="section-title" style={{ marginBottom: 40 }}>
              For DMOs.
              <br />
              And <span className="italic">local businesses</span>.
            </h2>
            <div className="duet">
              <div
                className="card card-orange"
                style={{ minHeight: 420, display: "flex", flexDirection: "column", justifyContent: "space-between" }}
              >
                <span className="mono eyebrow" style={{ color: "var(--cream)", opacity: 0.85 }}>
                  For locals &amp; small venues
                </span>
                <h3 className="big">
                  We fill your <span className="italic">quiet hours</span>, not your already-busy ones.
                </h3>
                <p style={{ opacity: 0.9 }}>
                  Cafes, workshops, small museums - tell us your slow windows. We route visitors there when it actually
                  helps.
                </p>
              </div>
              <div className="card" style={{ minHeight: 420 }}>
                <span className="mono eyebrow">Honest numbers</span>
                <div className="stats" style={{ marginTop: 80 }}>
                  <div className="stat green">
                    <div className="num">2 min</div>
                    <div className="lbl">from tap to full itinerary</div>
                  </div>
                  <div className="stat orange">
                    <div className="num">4</div>
                    <div className="lbl">inputs, nothing else required</div>
                  </div>
                  <div className="stat navy">
                    <div className="num">CH</div>
                    <div className="lbl">built for Switzerland &amp; DACH region</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="cta">
          <h2>
            Spend your <span className="italic accent">Saturdays</span> better.
          </h2>
          <div className="cta-row">
            <p>We&apos;ll write once, when it&apos;s ready. One email, no name, no follow-ups unless you ask.</p>
            {submitted ? (
              <p>Thanks for joining. We&apos;ll email you when Wellspent is ready.</p>
            ) : (
              <form className="form" onSubmit={handleSubmit} style={{ background: "#fff" }}>
                <input
                  type="email"
                  placeholder="you@example.ch"
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  required
                />
                <button className="btn" type="submit" disabled={loading}>
                  {loading ? "Joining..." : "Join the waitlist →"}
                </button>
              </form>
            )}
            {error && <p>{error}</p>}
          </div>
        </div>
      </main>

      <footer>
        <div className="foot-inner">
          <div className="foot-right">
            <div className="foot-col">
              <span className="mono">Made in</span>
              Winterthur, CH
            </div>
            <div className="foot-col">
              <span className="mono">Contact</span>
              <a href="mailto:hello@wellspent.world" style={{ color: "inherit", textDecoration: "none" }}>
                hello@wellspent.world
              </a>
            </div>
            <div className="foot-socials">
              <a
                href="https://www.instagram.com/wellspent.world/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
              >
                <img src="/landing/instagram.svg" alt="Instagram" />
              </a>
              <a
                href="https://www.linkedin.com/company/wellspent-world"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn"
              >
                <img src="/landing/linkedin.svg" alt="LinkedIn" />
              </a>
              <a
                href="https://www.tiktok.com/@wellspent.world"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="TikTok"
              >
                <img src="/landing/tiktok.svg" alt="TikTok" />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
