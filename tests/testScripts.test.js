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
      },
      viewedUserProfile: null,
      theme: "dark"
    });
  });

  test("theme defaults to dark and can be updated", () => {
    expect(storage.getTheme()).toBe("dark");
    storage.setTheme("light");
    expect(storage.getTheme()).toBe("light");
    storage.setTheme("unknown");
    expect(storage.getTheme()).toBe("dark");
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
        Director: "Christopher Nolan",
        Poster: "http://example.com/inception.jpg"
      })
    });

    const movie = await api.fetchMovieByTitle("Inception", fetchMock);

    expect(movie).toEqual({
      title: "Inception",
      year: "2010",
      plot: "Dreams within dreams",
      genre: "Sci-Fi",
      director: "Christopher Nolan",
      poster: "http://example.com/inception.jpg"
    });
  });

  test("fetchMovieRatings retrieves other users' ratings for a movie", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      json: jest.fn().mockResolvedValue([
        { username: "bob", rating: "4", review: "Great movie!" },
        { username: "charlie", rating: "3", review: "It was OK" }
      ])
    });

    const ratings = await api.fetchMovieRatings("Inception", fetchMock);

    expect(ratings).toHaveLength(2);
    expect(ratings[0]).toEqual({ username: "bob", rating: "4", review: "Great movie!" });
    expect(ratings[1]).toEqual({ username: "charlie", rating: "3", review: "It was OK" });
    expect(fetchMock).toHaveBeenCalledWith(
      `/get-movie-ratings?movie=${encodeURIComponent("Inception")}`
    );
  });

  test("fetchMovieRatings returns empty array when no ratings exist", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      json: jest.fn().mockResolvedValue([])
    });

    const ratings = await api.fetchMovieRatings("Avatar", fetchMock);

    expect(ratings).toEqual([]);
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

  test("renderOtherUserRatings renders ratings from other users", () => {
    const container = document.createElement("ul");
    const ratings = [
      { username: "bob", rating: "4", review: "Great movie!" },
      { username: "charlie", rating: "3", review: "It was OK" }
    ];

    ui.renderOtherUserRatings(ratings, container, document);

    const items = container.querySelectorAll("li");
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain("bob");
    expect(items[0].textContent).toContain("4 stars");
    expect(items[0].textContent).toContain("Great movie!");
    expect(items[1].textContent).toContain("charlie");
    expect(items[1].textContent).toContain("3 stars");
    expect(items[1].textContent).toContain("It was OK");
  });

  test("renderOtherUserRatings shows empty message when no ratings exist", () => {
    const container = document.createElement("ul");

    ui.renderOtherUserRatings([], container, document);

    const items = container.querySelectorAll("li");
    expect(items).toHaveLength(1);
    expect(items[0].classList.contains("empty-list-item")).toBe(true);
    expect(items[0].textContent).toBe("No public ratings yet.");
  });

  test("renderOtherUserRatings does not show review section if review is absent", () => {
    const container = document.createElement("ul");
    const ratings = [
      { username: "bob", rating: "4" }
    ];

    ui.renderOtherUserRatings(ratings, container, document);

    const items = container.querySelectorAll("li");
    expect(items[0].textContent).toContain("bob");
    expect(items[0].textContent).toContain("4 stars");
    expect(items[0].querySelector(".other-user-review")).toBeNull();
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

  // Extended mock stub for new cross-user features
  function createMoviePageStub(options = {}) {
    const {
      includeOtherUsersSection = false,
      includeUserProfileSection = false
    } = options;

    let markup = `
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
    `;

    if (includeOtherUsersSection) {
      markup += `
      <section id="other-users-ratings">
        <h3>Other Users' Ratings</h3>
        <ul id="ratings-list"></ul>
      </section>
      `;
    }

    if (includeUserProfileSection) {
      markup += `
      <section id="viewed-user-profile">
        <h3 id="viewed-username"></h3>
        <ul id="viewed-user-watchlist"></ul>
        <ul id="viewed-user-watched"></ul>
      </section>
      `;
    }

    return createDocumentStub(markup);
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

  test("openSearch shows personalized recommendations before typing", async () => {
    const fakeDocument = createDocumentStub(`
      <a class="signout" href="signin.html">Sign Out</a>
      <input id="searchbox" value="" />
      <p id="searchStatus"></p>
      <div id="searchMenu"></div>
      <button id="search">Search</button>
    `);

    jest.spyOn(api, "fetchWatchlist").mockResolvedValue(["The Dark Knight"]);
    jest.spyOn(api, "fetchWatched").mockResolvedValue({});
    jest.spyOn(api, "fetchMovieByTitle").mockImplementation(async (title) => {
      const movieMap = {
        "Inception": {
          title: "Inception",
          genre: "Action, Sci-Fi",
          director: "Christopher Nolan",
          poster: "http://example.com/inception.jpg"
        },
        "Interstellar": {
          title: "Interstellar",
          genre: "Adventure, Sci-Fi",
          director: "Christopher Nolan",
          poster: "http://example.com/interstellar.jpg"
        },
        "The Dark Knight": {
          title: "The Dark Knight",
          genre: "Action, Crime, Drama",
          director: "Christopher Nolan",
          poster: "http://example.com/darkknight.jpg"
        },
        "The Shawshank Redemption": {
          title: "The Shawshank Redemption",
          genre: "Drama",
          director: "Frank Darabont",
          poster: "http://example.com/shawshank.jpg"
        },
        "Pulp Fiction": {
          title: "Pulp Fiction",
          genre: "Crime, Drama",
          director: "Quentin Tarantino",
          poster: "http://example.com/pulpfiction.jpg"
        },
        "The Godfather": {
          title: "The Godfather",
          genre: "Crime, Drama",
          director: "Francis Ford Coppola",
          poster: "http://example.com/godfather.jpg"
        },
        "Parasite": {
          title: "Parasite",
          genre: "Drama, Thriller",
          director: "Bong Joon-ho",
          poster: "http://example.com/parasite.jpg"
        },
        "Mad Max: Fury Road": {
          title: "Mad Max: Fury Road",
          genre: "Action, Adventure",
          director: "George Miller",
          poster: "http://example.com/madmax.jpg"
        },
        "The Matrix": {
          title: "The Matrix",
          genre: "Action, Sci-Fi",
          director: "Lana Wachowski",
          poster: "http://example.com/matrix.jpg"
        },
        "Whiplash": {
          title: "Whiplash",
          genre: "Drama, Music",
          director: "Damien Chazelle",
          poster: "http://example.com/whiplash.jpg"
        }
      };

      return movieMap[title] || null;
    });

    await app.openSearch(fakeDocument);

    const titles = Array.from(document.querySelectorAll(".search-result-title")).map((element) => element.textContent);
    expect(titles.length).toBe(5);
    expect(titles[0]).toBe("Inception");
    expect(document.querySelector("#searchStatus").textContent)
      .toContain("Recommended for you");
  });

  test("openSearch falls back to popular recommendations when no user history exists", async () => {
    const fakeDocument = createDocumentStub(`
      <a class="signout" href="signin.html">Sign Out</a>
      <input id="searchbox" value="" />
      <p id="searchStatus"></p>
      <div id="searchMenu"></div>
      <button id="search">Search</button>
    `);

    jest.spyOn(api, "fetchWatchlist").mockResolvedValue([]);
    jest.spyOn(api, "fetchWatched").mockResolvedValue({});
    jest.spyOn(api, "fetchMovieByTitle").mockImplementation(async (title) => ({
      title,
      genre: "Drama",
      director: "Fallback Director",
      poster: `http://example.com/${title}.jpg`
    }));

    await app.openSearch(fakeDocument);

    const titles = Array.from(document.querySelectorAll(".search-result-title")).map((element) => element.textContent);
    expect(titles.length).toBe(5);
    expect(titles[0]).toBe("Inception");
    expect(document.querySelector("#searchStatus").textContent)
      .toContain("Popular movies");
  });

  test("openFindUser stores selected username and navigates to user profile", async () => {
    const fakeDocument = createDocumentStub(`
      <a class="signout" href="signin.html">Sign Out</a>
      <input id="findUserInput" value="bob" />
      <ul id="findUserSuggestions"></ul>
      <button id="findUserButton">View Profile</button>
      <p id="findUserStatus"></p>
    `);

    jest.spyOn(api, "fetchUserProfile").mockResolvedValue({
      found: true,
      profile: {
        username: "bob",
        watchlist: ["Dune"],
        watched: {}
      }
    });

    await app.openFindUser(fakeDocument);
    document.querySelector("#findUserButton").click();

    await Promise.resolve();
    await Promise.resolve();

    expect(storage.getViewedUserProfile()).toBe("bob");
    expect(fakeDocument.location.href).toBe("userprofile.html");
  });

  test("openFindUser shows autocomplete suggestions and fills input on click", async () => {
    const fakeDocument = createDocumentStub(`
      <a class="signout" href="signin.html">Sign Out</a>
      <input id="findUserInput" value="" />
      <ul id="findUserSuggestions"></ul>
      <button id="findUserButton">View Profile</button>
      <p id="findUserStatus"></p>
    `);

    jest.spyOn(api, "fetchUserSuggestions").mockResolvedValue(["bob", "bobby"]);
    jest.spyOn(api, "fetchUserProfile").mockResolvedValue({ found: false });

    await app.openFindUser(fakeDocument);

    const input = document.querySelector("#findUserInput");
    input.value = "bo";
    input.dispatchEvent(new Event("input"));

    await Promise.resolve();
    await Promise.resolve();

    const suggestions = document.querySelectorAll("#findUserSuggestions li");
    expect(suggestions.length).toBe(2);
    expect(suggestions[0].textContent).toBe("bob");

    suggestions[0].click();
    expect(document.querySelector("#findUserInput").value).toBe("bob");
  });

  test("openUserProfile renders watchlist, watched movies, and recent reviews", async () => {
    storage.setViewedUserProfile("bob");

    const fakeDocument = createDocumentStub(`
      <a class="signout" href="signin.html">Sign Out</a>
      <h2 id="profileUsername"></h2>
      <p id="profileStatus"></p>
      <button id="followUserButton"></button>
      <p id="followUserStatus"></p>
      <ul id="profileWatchlist"></ul>
      <ul id="profileWatched"></ul>
      <ul id="profileRecentReviews"></ul>
    `);

    jest.spyOn(api, "fetchUserProfile").mockResolvedValue({
      found: true,
      isFollowing: false,
      isSelf: false,
      profile: {
        username: "bob",
        watchlist: ["Dune", "Arrival"],
        watched: {
          "Inception": { rating: "5", review: "Great." },
          "Interstellar": { rating: "4", review: "" },
          "Memento": { rating: "4", review: "Very clever." }
        }
      }
    });

    await app.openUserProfile(fakeDocument);

    expect(document.querySelector("#profileUsername").textContent).toBe("bob's Profile");
    expect(document.querySelectorAll("#profileWatchlist li").length).toBe(2);
    expect(document.querySelectorAll("#profileWatched li").length).toBe(3);
    expect(document.querySelectorAll("#profileRecentReviews li").length).toBe(2);
    expect(document.querySelector("#profileRecentReviews").textContent).toContain("Memento");
    expect(document.querySelector("#followUserButton").textContent).toBe("Follow");
  });

  test("openUserProfile follow button toggles follow state", async () => {
    storage.setViewedUserProfile("bob");
    const fakeDocument = createDocumentStub(`
      <a class="signout" href="signin.html">Sign Out</a>
      <h2 id="profileUsername"></h2>
      <p id="profileStatus"></p>
      <button id="followUserButton"></button>
      <p id="followUserStatus"></p>
      <ul id="profileWatchlist"></ul>
      <ul id="profileWatched"></ul>
      <ul id="profileRecentReviews"></ul>
    `);

    jest.spyOn(api, "fetchUserProfile").mockResolvedValue({
      found: true,
      isFollowing: false,
      isSelf: false,
      profile: {
        username: "bob",
        watchlist: [],
        watched: {}
      }
    });
    const followSpy = jest.spyOn(api, "followUser").mockResolvedValue(true);
    const unfollowSpy = jest.spyOn(api, "unfollowUser").mockResolvedValue(true);

    await app.openUserProfile(fakeDocument);

    document.querySelector("#followUserButton").click();
    await Promise.resolve();
    expect(followSpy).toHaveBeenCalledWith("bob");
    expect(document.querySelector("#followUserButton").textContent).toBe("Unfollow");

    document.querySelector("#followUserButton").click();
    await Promise.resolve();
    expect(unfollowSpy).toHaveBeenCalledWith("bob");
    expect(document.querySelector("#followUserButton").textContent).toBe("Follow");
  });

  test("openMyMovies renders activity feed messages", async () => {
    const fakeDocument = createDocumentStub(`
      <a class="signout" href="signin.html">Sign Out</a>
      <ul id="moviesList"></ul>
      <ul id="activityFeed"></ul>
    `);

    jest.spyOn(api, "fetchWatched").mockResolvedValue({
      Dune: { rating: "5", review: "Epic." }
    });
    jest.spyOn(api, "fetchPosterByTitle").mockResolvedValue("http://example.com/dune.jpg");
    jest.spyOn(api, "fetchActivityFeed").mockResolvedValue([
      { username: "bob", type: "rated_movie", movie: "Arrival", rating: "4", review: "Great." },
      { username: "mia", type: "watchlist_added", movie: "Inception" }
    ]);

    await app.openMyMovies(fakeDocument);

    expect(document.querySelectorAll("#activityFeed li").length).toBe(2);
    expect(document.querySelector("#activityFeed").textContent).toContain("bob rated Arrival 4 stars");
    expect(document.querySelector("#activityFeed").textContent).toContain("mia added Inception");
  });

  test("openSettings loads and saves privacy and theme settings", async () => {
    const fakeDocument = createDocumentStub(`
      <a class="signout" href="signin.html">Sign Out</a>
      <p id="settingsStatus"></p>
      <input id="settingsUsername" type="text" />
      <input id="privacyWatchlist" type="checkbox" />
      <input id="privacyRatings" type="checkbox" />
      <input id="privacyReviews" type="checkbox" />
      <input id="privacyActivity" type="checkbox" />
      <button id="savePrivacyButton">Save</button>
      <button id="updatePasswordButton">Update Password</button>
      <button id="updateUsernameButton">Update Username</button>
      <input id="currentPasswordForUsername" type="password" />
      <input id="newUsername" type="text" />
      <input id="currentPassword" type="password" />
      <input id="newPassword" type="password" />
      <p id="passwordStatus"></p>
      <p id="usernameStatus"></p>
      <input id="themeToggle" type="checkbox" />
      <p id="themeStatus"></p>
    `);

    jest.spyOn(api, "fetchSettings").mockResolvedValue({
      username: "alice",
      privacy: {
        showWatchlist: true,
        showRatings: true,
        showReviews: false,
        showActivity: true
      }
    });
    const privacySpy = jest.spyOn(api, "updatePrivacySettings").mockResolvedValue(true);
    jest.spyOn(api, "updatePassword").mockResolvedValue(true);
    jest.spyOn(api, "updateUsername").mockResolvedValue(true);

    await app.openSettings(fakeDocument);

    expect(document.querySelector("#settingsUsername").value).toBe("alice");
    expect(document.querySelector("#privacyReviews").checked).toBe(false);

    document.querySelector("#privacyReviews").checked = true;
    document.querySelector("#savePrivacyButton").click();
    await Promise.resolve();

    expect(privacySpy).toHaveBeenCalled();

    document.querySelector("#themeToggle").checked = true;
    document.querySelector("#themeToggle").dispatchEvent(new Event("change"));
    expect(storage.getTheme()).toBe("light");
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
      <ul id="otherUserRatings"></ul>
    `);
    global.fetch = jest.fn((url) => {
      if (url === "/get-watched") {
        return Promise.resolve({ json: () => Promise.resolve(watchedPayload) });
      }
      if (url.includes("/get-movie-ratings")) {
        return Promise.resolve({ json: () => Promise.resolve([
          { username: "bob", rating: "5", review: "Masterpiece" },
          { username: "charlie", rating: "4", review: "Very good" }
        ]) });
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

    // Verify other users' ratings are loaded
    await Promise.resolve();
    const ratingItems = document.querySelectorAll("#otherUserRatings li");
    expect(ratingItems.length).toBeGreaterThan(0);
    expect(document.querySelector("#otherUserRatings").textContent).toContain("bob");
    expect(document.querySelector("#otherUserRatings").textContent).toContain("Masterpiece");

    document.querySelector("#addToList").click();
    document.querySelector("#written-review").value = "Great worldbuilding and scope";
    document.querySelectorAll(".image-button")[2].click();
    document.querySelector("#saveReview").click();

    await Promise.resolve();
    await Promise.resolve();

    expect(addToWatchlistSpy).toHaveBeenCalledWith("Dune");
    expect(addToWatchedSpy).toHaveBeenCalledWith("Dune", 3, "Great worldbuilding and scope");
    expect(document.querySelector("#review-status").textContent).toBe("Review saved.");
    expect(fakeDocument.location.href).toBe("signin.html");
    expect(document.querySelector("#addToList").textContent).toBe("Remove from Watchlist");
  });

  test("openMovie loads other users' ratings from the API", async () => {
    storage.setSelectedMovie({
      title: "Inception",
      year: "2010",
      plot: "Dreams within dreams",
      genre: "Sci-Fi",
      poster: "http://example.com/inception.jpg"
    });

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
      <ul id="otherUserRatings"></ul>
    `);

    const fetchMovieRatingsSpy = jest.spyOn(api, "fetchMovieRatings").mockResolvedValue([
      { username: "alice", rating: "5", review: "Amazing" },
      { username: "bob", rating: "4", review: "Good" }
    ]);

    global.fetch = jest.fn((url) => {
      if (url === "/get-watched") {
        return Promise.resolve({ json: () => Promise.resolve({}) });
      }
      return Promise.resolve({ json: () => Promise.resolve(true) });
    });

    await app.openMovie(fakeDocument);
    await Promise.resolve();

    expect(fetchMovieRatingsSpy).toHaveBeenCalledWith("Inception");
  });

  // Additional test to cover the case where user tries to save a review without selecting a star rating
  test("openMovie save review without star selection shows warning and does not submit", async () => {
    storage.setSelectedMovie({
      title: "Dune",
      year: "2021",
      plot: "Paul Atreides leads a desert uprising",
      genre: "Sci-Fi",
      poster: "http://example.com/dune.jpg"
    });
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
        return Promise.resolve({ json: () => Promise.resolve({}) });
      }

      return Promise.resolve({ json: () => Promise.resolve(true) });
    });
    const addToWatchedSpy = jest.spyOn(api, "addToWatched").mockResolvedValue(true);

    await app.openMovie(fakeDocument);

    document.querySelector("#written-review").value = "Should not save yet";
    document.querySelector("#saveReview").click();

    await Promise.resolve();

    expect(addToWatchedSpy).not.toHaveBeenCalled();
    expect(document.querySelector("#review-status").textContent)
      .toBe("Select a star rating before saving your review.");
  });

  // ========== BACKWARD COMPATIBILITY TESTS ==========
  // Verify that extended mock with new features disabled behaves identically to old mock

  test("BACKWARD COMPAT: extended mock with features disabled produces identical openMovie behavior", async () => {
    storage.setSelectedMovie({
      title: "Dune",
      year: "2021",
      plot: "Paul Atreides leads a desert uprising",
      genre: "Sci-Fi",
      poster: "http://example.com/dune.jpg"
    });

    // Use extended stub with new features disabled (default)
    const fakeDocument = createMoviePageStub({
      includeOtherUsersSection: false,
      includeUserProfileSection: false
    });

    const watchedPayload = {
      Dune: {
        rating: "2",
        review: "Original draft review"
      }
    };

    global.fetch = jest.fn((url) => {
      if (url === "/get-watched") {
        return Promise.resolve({ json: () => Promise.resolve(watchedPayload) });
      }
      return Promise.resolve({ json: () => Promise.resolve(true) });
    });

    const addToWatchedSpy = jest.spyOn(api, "addToWatched").mockResolvedValue(true);

    await app.openMovie(fakeDocument);

    // All existing assertions must pass
    expect(document.querySelector("#movie-title").textContent).toBe("Dune");
    expect(document.querySelector("#written-review").value).toBe("Original draft review");

    // Verify new sections do NOT exist
    expect(document.querySelector("#other-users-ratings")).toBeNull();
    expect(document.querySelector("#viewed-user-profile")).toBeNull();

    // Verify old behavior still works
    document.querySelector("#written-review").value = "Still works";
    document.querySelectorAll(".image-button")[2].click();
    document.querySelector("#saveReview").click();

    await Promise.resolve();
    await Promise.resolve();

    expect(addToWatchedSpy).toHaveBeenCalledWith("Dune", 3, "Still works");
  });

  test("BACKWARD COMPAT: extended fetch mock handles old endpoints unchanged", async () => {
    // Mock the extended fetch that handles both old and new endpoints
    global.fetch = jest.fn((url) => {
      // New endpoints
      if (url.includes("/get-movie-ratings")) {
        return Promise.resolve({
          json: () => Promise.resolve([
            { user: "bob", rating: "4", review: "Great" },
            { user: "charlie", rating: "3", review: "OK" }
          ])
        });
      }
      if (url.includes("/get-user-watchlist")) {
        return Promise.resolve({
          json: () => Promise.resolve(["Inception", "Tenet"])
        });
      }
      if (url.includes("/get-all-users")) {
        return Promise.resolve({
          json: () => Promise.resolve(["alice", "bob", "charlie"])
        });
      }
      // Old endpoints (must still work)
      if (url === "/get-watched") {
        return Promise.resolve({
          json: () => Promise.resolve({
            "Inception": { rating: "5", review: "Mind-bending" }
          })
        });
      }
      if (url === "/get-watchlist") {
        return Promise.resolve({
          json: () => Promise.resolve(["Dune", "Tenet"])
        });
      }
      return Promise.resolve({ json: () => Promise.resolve(true) });
    });

    // Old endpoint still returns correct data
    const watchedResponse = await fetch("/get-watched");
    const watched = await watchedResponse.json();
    expect(watched["Inception"].rating).toBe("5");
    expect(watched["Inception"].review).toBe("Mind-bending");

    const watchlistResponse = await fetch("/get-watchlist");
    const watchlist = await watchlistResponse.json();
    expect(watchlist).toContain("Dune");
    expect(watchlist).toContain("Tenet");
  });

  test("extended mock: new endpoints work correctly without breaking old behavior", async () => {
    global.fetch = jest.fn((url) => {
      if (url.includes("/get-movie-ratings?title=Dune")) {
        return Promise.resolve({
          json: () => Promise.resolve([
            { user: "bob", rating: "4", review: "Stunning" },
            { user: "charlie", rating: "3", review: "Long" }
          ])
        });
      }
      if (url.includes("/get-user-watchlist?user=bob")) {
        return Promise.resolve({
          json: () => Promise.resolve(["Inception", "Tenet"])
        });
      }
      if (url.includes("/get-all-users")) {
        return Promise.resolve({
          json: () => Promise.resolve(["alice", "bob", "charlie"])
        });
      }
      // Old endpoints still work
      if (url === "/get-watched") {
        return Promise.resolve({
          json: () => Promise.resolve({ "Dune": { rating: "5", review: "Epic" } })
        });
      }
      return Promise.resolve({ json: () => Promise.resolve(true) });
    });

    // Call new endpoints
    const ratingsResponse = await fetch("/get-movie-ratings?title=Dune");
    const ratings = await ratingsResponse.json();
    expect(ratings).toHaveLength(2);
    expect(ratings[0].user).toBe("bob");
    expect(ratings[0].rating).toBe("4");

    const watchlistResponse = await fetch("/get-user-watchlist?user=bob");
    const watchlist = await watchlistResponse.json();
    expect(watchlist).toContain("Inception");

    const usersResponse = await fetch("/get-all-users");
    const users = await usersResponse.json();
    expect(users).toEqual(["alice", "bob", "charlie"]);

    // Old endpoints still work
    const watchedResponse = await fetch("/get-watched");
    const watched = await watchedResponse.json();
    expect(watched["Dune"].rating).toBe("5");
  });

  test("storage: viewedUserProfile defaults to null and can be set", () => {
    const state = storage.createDefaultState();
    expect(state.viewedUserProfile).toBeNull();

    storage.setViewedUserProfile("bob");
    expect(storage.getViewedUserProfile()).toBe("bob");

    storage.setViewedUserProfile("charlie");
    expect(storage.getViewedUserProfile()).toBe("charlie");

    storage.clearAppState();
    expect(storage.getViewedUserProfile()).toBeNull();
  });
});

describe("search feature", () => {
  beforeEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });

  test("searchMovies returns first 5 results from API", async () => {
    const mockSearchResults = {
      Response: "True",
      Search: [
        { Title: "Inception", Year: "2010", Plot: "Dream heist", Genre: "Sci-Fi", Poster: "http://example.com/inception.jpg" },
        { Title: "Interstellar", Year: "2014", Plot: "Space exploration", Genre: "Sci-Fi", Poster: "http://example.com/interstellar.jpg" },
        { Title: "The Prestige", Year: "2006", Plot: "Magic rivalry", Genre: "Drama", Poster: "http://example.com/prestige.jpg" },
        { Title: "Batman Begins", Year: "2005", Plot: "Origin story", Genre: "Action", Poster: "http://example.com/batman.jpg" },
        { Title: "The Dark Knight", Year: "2008", Plot: "Joker chaos", Genre: "Action", Poster: "http://example.com/darkknight.jpg" },
        { Title: "Tenet", Year: "2020", Plot: "Time inversion", Genre: "Sci-Fi", Poster: "http://example.com/tenet.jpg" }
      ]
    };

    const fetchMock = jest.fn().mockResolvedValue({
      json: jest.fn().mockResolvedValue(mockSearchResults)
    });

    const results = await api.searchMovies("nolan", fetchMock);

    expect(results).toHaveLength(5);
    expect(results[0]).toEqual({
      title: "Inception",
      year: "2010",
      plot: "Dream heist",
      genre: "Sci-Fi",
      poster: "http://example.com/inception.jpg"
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("s=nolan")
    );
  });

  test("searchMovies returns empty array when no results found", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      json: jest.fn().mockResolvedValue({ Response: "False" })
    });

    const results = await api.searchMovies("nonexistentmovie", fetchMock);

    expect(results).toEqual([]);
  });

  test("renderSearchResults populates menu with clickable movie cards", async () => {
    document.body.innerHTML = "<div id=\"searchMenu\"></div>";
    const onSelect = jest.fn();
    
    const movies = [
      { title: "Inception", year: "2010", plot: "Dream heist", genre: "Sci-Fi", poster: "http://example.com/inception.jpg" },
      { title: "Interstellar", year: "2014", plot: "Space exploration", genre: "Sci-Fi", poster: "http://example.com/interstellar.jpg" }
    ];

    await ui.renderSearchResults(
      document.querySelector("#searchMenu"),
      movies,
      onSelect,
      document
    );

    const items = document.querySelectorAll("#searchMenu .search-result-card");
    expect(items).toHaveLength(2);
    expect(items[0].querySelector(".search-result-title").textContent).toBe("Inception");
    expect(items[1].querySelector(".search-result-title").textContent).toBe("Interstellar");
    expect(items[0].querySelector(".search-result-poster").getAttribute("src"))
      .toBe("http://example.com/inception.jpg");

    items[0].click();
    expect(onSelect).toHaveBeenCalledWith(movies[0]);
  });

  test("openSearch wires input event on searchbox to call searchMovies", async () => {
    document.body.innerHTML = `
      <input id="searchbox" type="text" />
      <div id="searchMenu"></div>
      <button id="search">Search</button>
      <a class="signout" href="signin.html">Sign Out</a>
    `;
    
    const fakeDocument = {
      location: { href: "search.html" },
      querySelector: document.querySelector.bind(document),
      querySelectorAll: document.querySelectorAll.bind(document),
      createElement: document.createElement.bind(document),
      createTextNode: document.createTextNode.bind(document)
    };

    const searchMoviesSpy = jest.spyOn(api, "searchMovies").mockResolvedValue([
      { title: "Test Movie", year: "2020", plot: "Test", genre: "Drama", poster: "http://example.com/test.jpg" }
    ]);

    app.openSearch(fakeDocument);

    const searchbox = document.querySelector("#searchbox");
    searchbox.value = "test";
    searchbox.dispatchEvent(new Event("input", { bubbles: true }));

    await Promise.resolve();
    await Promise.resolve();

    expect(searchMoviesSpy).toHaveBeenCalledWith("test");
    expect(document.querySelector("#searchMenu .search-result-card")).not.toBeNull();
    expect(document.querySelector("#searchMenu .search-result-title").textContent).toBe("Test Movie");
  });

  test("openSearch clears menu when searchbox is empty", async () => {
    document.body.innerHTML = `
      <input id="searchbox" type="text" />
      <div id="searchMenu"><div>Old Result</div></div>
      <button id="search">Search</button>
      <a class="signout" href="signin.html">Sign Out</a>
    `;
    
    const fakeDocument = {
      location: { href: "search.html" },
      querySelector: document.querySelector.bind(document),
      querySelectorAll: document.querySelectorAll.bind(document),
      createElement: document.createElement.bind(document),
      createTextNode: document.createTextNode.bind(document)
    };

    jest.spyOn(api, "searchMovies").mockResolvedValue([]);

    app.openSearch(fakeDocument);

    const searchbox = document.querySelector("#searchbox");
    searchbox.value = "";
    searchbox.dispatchEvent(new Event("input", { bubbles: true }));

    await Promise.resolve();

    expect(document.querySelector("#searchMenu").innerHTML).toBe("");
  });

  test("openSearch navigates to movie page when result is clicked", async () => {
    document.body.innerHTML = `
      <input id="searchbox" type="text" />
      <div id="searchMenu"></div>
      <button id="search">Search</button>
      <a class="signout" href="signin.html">Sign Out</a>
    `;
    
    const fakeDocument = {
      location: { href: "search.html" },
      querySelector: document.querySelector.bind(document),
      querySelectorAll: document.querySelectorAll.bind(document),
      createElement: document.createElement.bind(document),
      createTextNode: document.createTextNode.bind(document)
    };

    const suggestionMovie = { title: "Test Movie", year: "2020", plot: "", genre: "Drama", poster: "http://example.com/test.jpg" };
    const fullMovie = {
      title: "Test Movie",
      year: "2020",
      plot: "Full plot loaded from title lookup",
      genre: "Drama",
      poster: "http://example.com/test.jpg"
    };
    jest.spyOn(api, "searchMovies").mockResolvedValue([suggestionMovie]);
    jest.spyOn(api, "fetchMovieByTitle").mockResolvedValue(fullMovie);

    app.openSearch(fakeDocument);

    const searchbox = document.querySelector("#searchbox");
    searchbox.value = "test";
    searchbox.dispatchEvent(new Event("input", { bubbles: true }));

    await Promise.resolve();
    await Promise.resolve();

    document.querySelector("#searchMenu .search-result-card").click();

    expect(storage.loadAppState().selectedMovie).toEqual(fullMovie);
    expect(fakeDocument.location.href).toBe("movie.html");
  });
});

describe("scripts entrypoint", () => {
  test("exposes browser page hooks", () => {
    expect(entry.openSignin).toBeDefined();
    expect(global.opensignin).toBe(entry.openSignin);
    expect(global.openmovie).toBe(entry.openMovie);
  });
});
