const storage = require("../public/scripts/storage");
const api = require("../public/scripts/api");
const ui = require("../public/scripts/ui");
const app = require("../public/scripts/app");
const entry = require("../public/scripts/scripts");

describe("storage module", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("saves and loads a single app state object", () => {
    storage.saveAppState({
      loggedIn: true,
      selectedMovie: {
        title: "The Matrix",
        year: "1999",
        plot: "A hacker learns the truth",
        genre: "Sci-Fi",
        poster: "http://example.com/matrix.jpg"
      }
    });

    expect(storage.loadAppState()).toEqual({
      loggedIn: true,
      selectedMovie: {
        title: "The Matrix",
        year: "1999",
        plot: "A hacker learns the truth",
        genre: "Sci-Fi",
        poster: "http://example.com/matrix.jpg"
      }
    });
  });
});

describe("api module", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  test("postForm sends urlencoded data and returns parsed json", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      json: jest.fn().mockResolvedValue(true)
    });

    const result = await api.postForm("/API/LOGIN", { username: "alice", password: "pw" }, fetchMock);

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "/API/LOGIN",
      expect.objectContaining({
        method: "POST",
        body: new URLSearchParams({ username: "alice", password: "pw" }).toString()
      })
    );
  });

  test("fetchMovieByTitle normalizes OMDb results", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      json: jest.fn().mockResolvedValue({
        Response: "True",
        Title: "Inception",
        Year: "2010",
        Plot: "Dreams within dreams",
        Genre: "Sci-Fi",
        Poster: "http://example.com/inception.jpg"
      })
    });

    const movie = await api.fetchMovieByTitle("Inception", fetchMock);

    expect(movie).toEqual({
      title: "Inception",
      year: "2010",
      plot: "Dreams within dreams",
      genre: "Sci-Fi",
      poster: "http://example.com/inception.jpg"
    });
  });
});

describe("ui module", () => {
  beforeEach(() => {
    document.body.innerHTML = "<ul id=\"moviesList\"></ul>";
  });

  test("renderMovieList renders clickable movie entries", async () => {
    const onSelect = jest.fn();

    await ui.renderMovieList({
      container: document.querySelector("#moviesList"),
      entries: [{ title: "Arrival", rating: "4" }],
      fetchPoster: jest.fn().mockResolvedValue("http://example.com/arrival.jpg"),
      getPosterTitle: (entry) => entry.title,
      getLabel: (entry) => ` ${entry.title}; ${entry.rating} stars`,
      onSelect,
      documentRef: document
    });

    const listItem = document.querySelector("#moviesList li");
    expect(listItem.textContent).toContain("Arrival; 4 stars");

    listItem.click();
    expect(onSelect).toHaveBeenCalledWith({ title: "Arrival", rating: "4" });
  });
});

describe("app module", () => {
  beforeEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });

  function createDocumentStub(markup) {
    document.body.innerHTML = markup;
    return {
      location: { href: "signin.html" },
      querySelector: document.querySelector.bind(document),
      querySelectorAll: document.querySelectorAll.bind(document)
    };
  }

  test("handleAuthAction stores login state and redirects on success", async () => {
    const fakeDocument = { location: { href: "signin.html" } };

    const success = await app.handleAuthAction(
      jest.fn().mockResolvedValue(true),
      "alice",
      "pw",
      "mymovies.html",
      fakeDocument
    );

    expect(success).toBe(true);
    expect(storage.loadAppState().loggedIn).toBe(true);
    expect(fakeDocument.location.href).toBe("mymovies.html");
  });

  test("openSignin wires the real click handler", async () => {
    const fakeDocument = createDocumentStub(`
      <input id="username" value="alice" />
      <input id="password" value="pw" />
      <button id="signin">Sign In</button>
    `);
    const loginSpy = jest.spyOn(api, "login").mockResolvedValue(true);

    app.openSignin(fakeDocument);
    document.querySelector("#signin").click();

    await Promise.resolve();
    await Promise.resolve();

    expect(loginSpy).toHaveBeenCalledWith("alice", "pw");
    expect(storage.loadAppState().loggedIn).toBe(true);
    expect(fakeDocument.location.href).toBe("mymovies.html");
  });

  test("openMovie renders selected movie and loads/saves review updates", async () => {
    storage.setSelectedMovie({
      title: "Dune",
      year: "2021",
      plot: "Paul Atreides leads a desert uprising",
      genre: "Sci-Fi",
      poster: "http://example.com/dune.jpg"
    });
    const watchedPayload = {
      Dune: {
        rating: "2",
        review: "Original draft review"
      }
    };
    const fakeDocument = createDocumentStub(`
      <a class="signout" href="signin.html">Sign Out</a>
      <h1 id="movie-title"></h1>
      <p id="movie-genre"></p>
      <p id="movie-plot"></p>
      <p id="movie-year"></p>
      <img id="movie-poster" />
      <button id="addToList">Add</button>
      <button class="image-button"></button>
      <button class="image-button"></button>
      <button class="image-button"></button>
      <button class="image-button"></button>
      <button class="image-button"></button>
      <textarea id="written-review"></textarea>
      <button id="saveReview">Save Review</button>
      <p id="review-status"></p>
    `);
    global.fetch = jest.fn((url) => {
      if (url === "/get-watched") {
        return Promise.resolve({ json: () => Promise.resolve(watchedPayload) });
      }

      return Promise.resolve({ json: () => Promise.resolve(true) });
    });
    const addToWatchlistSpy = jest.spyOn(api, "addToWatchlist").mockResolvedValue(true);
    const addToWatchedSpy = jest.spyOn(api, "addToWatched").mockResolvedValue(true);

    await app.openMovie(fakeDocument);

    expect(document.querySelector("#movie-title").textContent).toBe("Dune");
    expect(document.querySelector("#written-review").value).toBe("Original draft review");
    expect(document.querySelectorAll(".image-button")[0].classList.contains("gold")).toBe(true);
    expect(document.querySelectorAll(".image-button")[1].classList.contains("gold")).toBe(true);
    expect(document.querySelectorAll(".image-button")[2].classList.contains("gold")).toBe(false);

    document.querySelector("#addToList").click();
    document.querySelector("#written-review").value = "Great worldbuilding and scope";
    document.querySelectorAll(".image-button")[2].click();
    document.querySelector("#saveReview").click();

    await Promise.resolve();
    await Promise.resolve();

    expect(addToWatchlistSpy).toHaveBeenCalledWith("Dune");
    expect(addToWatchedSpy).toHaveBeenCalledWith("Dune", 3, "Great worldbuilding and scope");
    expect(document.querySelector("#review-status").textContent).toBe("Review saved.");
    expect(fakeDocument.location.href).toBe("watchlist.html");
  });
});

describe("scripts entrypoint", () => {
  test("exposes browser page hooks", () => {
    expect(entry.openSignin).toBeDefined();
    expect(global.opensignin).toBe(entry.openSignin);
    expect(global.openmovie).toBe(entry.openMovie);
  });
});
