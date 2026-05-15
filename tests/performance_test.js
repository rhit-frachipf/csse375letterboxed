/**
 * Q4 tests — technology-facing, critiquing the product.
 *
 * These tests probe non-functional properties of the front-end modules:
 *   - Algorithmic performance of taste-profile scoring (app.js)
 *   - DOM rendering throughput under large lists (ui.js)
 *   - Storage serialisation overhead with large payloads (storage.js)
 *   - API module behaviour under many parallel in-flight requests (api.js)
 *
 * Run with:
 *   npx jest performance_test.js
 */

const storage = require("../public/scripts/storage");
const api = require("../public/scripts/api");
const ui = require("../public/scripts/ui");
const app = require("../public/scripts/app");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return wall-clock milliseconds for a synchronous thunk. */
function measureSync(fn) {
  const start = performance.now();
  fn();
  return performance.now() - start;
}

/** Return wall-clock milliseconds for an async thunk. */
async function measureAsync(fn) {
  const start = performance.now();
  await fn();
  return performance.now() - start;
}

/**
 * Build an array of movie objects with realistic genre/director fields, used
 * to seed the taste-profile scorer.
 */
function makeMovies(count) {
  const genres = ["Action", "Drama", "Sci-Fi", "Comedy", "Thriller", "Horror"];
  const directors = ["Director A", "Director B", "Director C", "Director D"];
  return Array.from({ length: count }, (_, i) => ({
    title: `Movie ${i}`,
    genre: `${genres[i % genres.length]}, ${genres[(i + 1) % genres.length]}`,
    director: directors[i % directors.length],
    year: String(2000 + (i % 24)),
    plot: `Plot for movie ${i}`,
    poster: `http://example.com/movie${i}.jpg`,
  }));
}

// ---------------------------------------------------------------------------
// Algorithmic performance — taste-profile scoring (app.js internals)
// ---------------------------------------------------------------------------
// These are accessed via the public surface: buildSearchRecommendations is not
// exported directly, so we stress-test scoreMovie/createTasteProfile through
// the recommendation pipeline driven by mocked api calls.

describe("app — taste-profile scoring performance", () => {
  const BUDGET_MS = 200; // all scoring work must finish in 200 ms

  beforeEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });

  test("recommendation scoring over 500 seed movies completes within budget", async () => {
    const seedMovies = makeMovies(500);
    const popularMovies = makeMovies(10).map((m, i) => ({
      ...m,
      title: [
        "Inception", "Interstellar", "The Dark Knight",
        "The Shawshank Redemption", "Pulp Fiction",
        "The Godfather", "Parasite", "Mad Max: Fury Road",
        "The Matrix", "Whiplash",
      ][i],
    }));

    jest.spyOn(api, "fetchWatchlist").mockResolvedValue(
      seedMovies.slice(0, 250).map((m) => m.title)
    );
    jest.spyOn(api, "fetchWatched").mockResolvedValue(
      Object.fromEntries(
        seedMovies.slice(250).map((m) => [m.title, { rating: "4", review: "" }])
      )
    );
    jest.spyOn(api, "fetchMovieByTitle").mockImplementation(async (title) => {
      return (
        seedMovies.find((m) => m.title === title) ||
        popularMovies.find((m) => m.title === title) ||
        null
      );
    });

    const fakeDocument = {
      location: { href: "search.html" },
      querySelector: () => null,
      querySelectorAll: () => [],
      createElement: document.createElement.bind(document),
      createTextNode: document.createTextNode.bind(document),
    };

    const elapsed = await measureAsync(() => app.openSearch(fakeDocument));

    expect(elapsed).toBeLessThan(BUDGET_MS);
  });

  test("repeated recommendation calls do not accumulate latency", async () => {
    // Simulates a user typing and clearing the search box several times,
    // triggering recommendation rebuilds on each clear.
    const movies = makeMovies(10);
    jest.spyOn(api, "fetchWatchlist").mockResolvedValue(["Movie 0", "Movie 1"]);
    jest.spyOn(api, "fetchWatched").mockResolvedValue({});
    jest.spyOn(api, "fetchMovieByTitle").mockImplementation(async (title) => {
      return movies.find((m) => m.title === title) || null;
    });

    document.body.innerHTML = `
      <a class="signout" href="#">Sign Out</a>
      <input id="searchbox" value="" />
      <p id="searchStatus"></p>
      <div id="searchMenu"></div>
      <button id="search">Search</button>
    `;

    const fakeDocument = {
      location: { href: "search.html" },
      querySelector: document.querySelector.bind(document),
      querySelectorAll: document.querySelectorAll.bind(document),
      createElement: document.createElement.bind(document),
      createTextNode: document.createTextNode.bind(document),
    };

    const times = [];
    for (let i = 0; i < 5; i++) {
      times.push(await measureAsync(() => app.openSearch(fakeDocument)));
    }

    // Each individual call must stay under budget.
    times.forEach((t, i) => {
      expect(t).toBeLessThan(500);
    });

    // Latency must not grow monotonically — the last call should not be more
    // than 3× the first (guards against unbounded accumulation).
    if (times[0] > 0) {
      expect(times[times.length - 1] / times[0]).toBeLessThan(3);
    }
  });
});

// ---------------------------------------------------------------------------
// DOM rendering throughput (ui.js)
// ---------------------------------------------------------------------------

describe("ui — renderMovieList throughput", () => {
  const BUDGET_MS = 500;

  beforeEach(() => {
    document.body.innerHTML = '<ul id="list"></ul>';
  });

  test("rendering 200 movie entries completes within budget", async () => {
    const entries = makeMovies(200);
    const container = document.querySelector("#list");

    const elapsed = await measureAsync(() =>
      ui.renderMovieList({
        container,
        entries,
        fetchPoster: jest.fn().mockResolvedValue("http://example.com/poster.jpg"),
        getPosterTitle: (e) => e.title,
        getLabel: (e) => ` ${e.title}; 4 stars`,
        onSelect: jest.fn(),
        documentRef: document,
      })
    );

    expect(elapsed).toBeLessThan(BUDGET_MS);
    // Sanity: all items were actually rendered.
    expect(container.querySelectorAll("li").length).toBe(200);
  });

  test("renderOtherUserRatings renders 500 items without hanging", () => {
    const container = document.createElement("ul");
    const ratings = Array.from({ length: 500 }, (_, i) => ({
      username: `user${i}`,
      rating: String((i % 5) + 1),
      review: `Review number ${i} with some extra text to be realistic.`,
    }));

    const elapsed = measureSync(() =>
      ui.renderOtherUserRatings(ratings, container, document)
    );

    expect(elapsed).toBeLessThan(300);
    expect(container.querySelectorAll("li").length).toBe(500);
  });

  test("renderSearchResults renders 50 cards within budget", async () => {
    document.body.innerHTML = '<div id="searchMenu"></div>';
    const container = document.querySelector("#searchMenu");
    const movies = makeMovies(50);

    const elapsed = await measureAsync(() =>
      ui.renderSearchResults(container, movies, jest.fn(), document)
    );

    expect(elapsed).toBeLessThan(200);
    expect(container.querySelectorAll(".search-result-card").length).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// Storage serialisation overhead (storage.js)
// ---------------------------------------------------------------------------

describe("storage — serialisation performance with large state", () => {
  const BUDGET_MS = 10; // localStorage ops should be essentially instant

  beforeEach(() => {
    localStorage.clear();
  });

  test("saving and loading a state with a large selectedMovie is fast", () => {
    // Simulate a movie object that has picked up extra fields over time.
    const fatMovie = {
      title: "Inception",
      year: "2010",
      plot: "A".repeat(5_000), // 5 KB plot field
      genre: "Sci-Fi, Action, Thriller",
      director: "Christopher Nolan",
      poster: "http://example.com/inception.jpg",
    };

    const saveTime = measureSync(() =>
      storage.saveAppState({ loggedIn: true, selectedMovie: fatMovie })
    );
    const loadTime = measureSync(() => storage.loadAppState());

    expect(saveTime).toBeLessThan(BUDGET_MS);
    expect(loadTime).toBeLessThan(BUDGET_MS);
  });

  test("1000 sequential save/load cycles complete within 1 second", () => {
    const state = { loggedIn: true, selectedMovie: { title: "Test", year: "2020", plot: "x", genre: "Drama", poster: "" } };
    const CYCLES = 1000;

    const elapsed = measureSync(() => {
      for (let i = 0; i < CYCLES; i++) {
        storage.saveAppState(state);
        storage.loadAppState();
      }
    });

    expect(elapsed).toBeLessThan(1_000);
  });

  test("theme toggle round-trip is sub-millisecond", () => {
    const elapsed = measureSync(() => {
      storage.setTheme("light");
      storage.getTheme();
      storage.setTheme("dark");
      storage.getTheme();
    });

    expect(elapsed).toBeLessThan(5);
  });
});

// ---------------------------------------------------------------------------
// API module — parallel request fan-out (api.js)
// ---------------------------------------------------------------------------

describe("api — parallel fetch fan-out", () => {
  const CONCURRENCY = 50;
  const BUDGET_MS = 500;

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  test(`${CONCURRENCY} parallel fetchMovieByTitle calls complete within budget`, async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      json: jest.fn().mockResolvedValue({
        Response: "True",
        Title: "Inception",
        Year: "2010",
        Plot: "Dreams within dreams",
        Genre: "Sci-Fi",
        Director: "Christopher Nolan",
        Poster: "http://example.com/inception.jpg",
      }),
    });

    const elapsed = await measureAsync(async () => {
      await Promise.all(
        Array.from({ length: CONCURRENCY }, (_, i) =>
          api.fetchMovieByTitle(`Movie ${i}`, fetchMock)
        )
      );
    });

    expect(elapsed).toBeLessThan(BUDGET_MS);
    expect(fetchMock).toHaveBeenCalledTimes(CONCURRENCY);
  });

  test(`${CONCURRENCY} parallel searchMovies calls complete within budget`, async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      json: jest.fn().mockResolvedValue({
        Response: "True",
        Search: makeMovies(5).map((m) => ({
          Title: m.title,
          Year: m.year,
          Plot: m.plot,
          Genre: m.genre,
          Poster: m.poster,
        })),
      }),
    });

    const elapsed = await measureAsync(async () => {
      await Promise.all(
        Array.from({ length: CONCURRENCY }, (_, i) =>
          api.searchMovies(`query${i}`, fetchMock)
        )
      );
    });

    expect(elapsed).toBeLessThan(BUDGET_MS);
  });

  test(`${CONCURRENCY} parallel postForm calls complete within budget`, async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      json: jest.fn().mockResolvedValue(true),
    });

    const elapsed = await measureAsync(async () => {
      await Promise.all(
        Array.from({ length: CONCURRENCY }, () =>
          api.postForm("/add-to-watchlist", { movie: "Inception" }, fetchMock)
        )
      );
    });

    expect(elapsed).toBeLessThan(BUDGET_MS);
    expect(fetchMock).toHaveBeenCalledTimes(CONCURRENCY);
  });
});

// ---------------------------------------------------------------------------
// Memory / object-growth guard — the taste profile must not grow unboundedly
// ---------------------------------------------------------------------------

describe("app — taste-profile memory footprint", () => {
  /**
   * We cannot directly inspect internal Maps, but we can verify that the
   * scoring pipeline produces a result in bounded time regardless of how many
   * distinct genres or directors the seed set contains. A runaway Map would
   * slow things down measurably.
   */
  test("scoring pipeline with 1000 unique genres completes within budget", async () => {
    // Each movie has a completely unique genre, so the genre weight map has
    // 1000 entries. The scorer must still finish promptly.
    const seedMovies = Array.from({ length: 1000 }, (_, i) => ({
      title: `Seed ${i}`,
      genre: `UniqueGenre${i}`,
      director: `UniqueDirector${i}`,
      year: "2020",
      plot: "",
      poster: "",
    }));

    jest.spyOn(api, "fetchWatchlist").mockResolvedValue(
      seedMovies.slice(0, 500).map((m) => m.title)
    );
    jest.spyOn(api, "fetchWatched").mockResolvedValue(
      Object.fromEntries(
        seedMovies.slice(500).map((m) => [m.title, { rating: "3", review: "" }])
      )
    );
    jest.spyOn(api, "fetchMovieByTitle").mockImplementation(async (title) =>
      seedMovies.find((m) => m.title === title) || {
        title,
        genre: "Drama",
        director: "Generic Director",
        year: "2020",
        plot: "",
        poster: "",
      }
    );

    const fakeDocument = {
      location: { href: "search.html" },
      querySelector: () => null,
      querySelectorAll: () => [],
      createElement: document.createElement.bind(document),
      createTextNode: document.createTextNode.bind(document),
    };

    const elapsed = await measureAsync(() => app.openSearch(fakeDocument));

    expect(elapsed).toBeLessThan(500);
  });
});
