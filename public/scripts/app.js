(function (root, factory) {
    if (typeof module === "object" && module.exports) {
        const storage = require("./storage");
        const api = require("./api");
        const ui = require("./ui");
        module.exports = factory(storage, api, ui, root);
    } else {
        root.LetterboxApp = factory(root.LetterboxStorage, root.LetterboxApi, root.LetterboxUi, root);
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function (storage, api, ui, root) {
    const POPULAR_FALLBACK_TITLES = [
        "Inception",
        "Interstellar",
        "The Dark Knight",
        "The Shawshank Redemption",
        "Pulp Fiction",
        "The Godfather",
        "Parasite",
        "Mad Max: Fury Road",
        "The Matrix",
        "Whiplash",
    ];

    function navigate(path, documentRef) {
        const doc = documentRef || root.document;
        doc.location.href = path;
    }

    function normalizeToken(token) {
        return (token || "").trim().toLowerCase();
    }

    function splitGenres(genreField) {
        if (!genreField) {
            return [];
        }

        return genreField
            .split(",")
            .map((genre) => normalizeToken(genre))
            .filter(Boolean);
    }

    function createTasteProfile(seedMovies) {
        const genreWeights = new Map();
        const directorWeights = new Map();

        seedMovies.forEach((movie) => {
            splitGenres(movie.genre).forEach((genre) => {
                genreWeights.set(genre, (genreWeights.get(genre) || 0) + 1);
            });

            const director = normalizeToken(movie.director);
            if (director) {
                directorWeights.set(director, (directorWeights.get(director) || 0) + 1);
            }
        });

        return {
            genreWeights,
            directorWeights,
        };
    }

    function scoreMovie(movie, tasteProfile) {
        let score = 0;
        const movieGenres = splitGenres(movie.genre);
        const movieDirector = normalizeToken(movie.director);

        movieGenres.forEach((genre) => {
            score += tasteProfile.genreWeights.get(genre) || 0;
        });

        if (movieDirector) {
            score += (tasteProfile.directorWeights.get(movieDirector) || 0) * 3;
        }

        return score;
    }

    async function fetchMoviesByTitle(titles) {
        const uniqueTitles = Array.from(new Set(titles.filter(Boolean)));
        const movies = await Promise.all(uniqueTitles.map((title) => api.fetchMovieByTitle(title)));
        const movieMap = new Map();

        uniqueTitles.forEach((title, index) => {
            if (movies[index]) {
                movieMap.set(title, movies[index]);
            }
        });

        return movieMap;
    }

    async function buildSearchRecommendations() {
        const [watchlist, watchedMovies] = await Promise.all([
            api.fetchWatchlist(),
            api.fetchWatched(),
        ]);
        const watchedTitles = Object.keys(watchedMovies || {});
        const seedTitles = Array.from(new Set([...(watchlist || []), ...watchedTitles]));
        const popularMovieMap = await fetchMoviesByTitle(POPULAR_FALLBACK_TITLES);

        if (seedTitles.length === 0) {
            return {
                movies: POPULAR_FALLBACK_TITLES.map((title) => popularMovieMap.get(title)).filter(Boolean).slice(0, 5),
                personalized: false,
            };
        }

        const seedMovieMap = await fetchMoviesByTitle(seedTitles.slice(0, 10));
        const seedMovies = Array.from(seedMovieMap.values());

        if (seedMovies.length === 0) {
            return {
                movies: POPULAR_FALLBACK_TITLES.map((title) => popularMovieMap.get(title)).filter(Boolean).slice(0, 5),
                personalized: false,
            };
        }

        const tasteProfile = createTasteProfile(seedMovies);
        const seedTitleSet = new Set(seedTitles.map((title) => normalizeToken(title)));

        const rankedPopularMovies = POPULAR_FALLBACK_TITLES
            .map((title) => popularMovieMap.get(title))
            .filter(Boolean)
            .filter((movie) => !seedTitleSet.has(normalizeToken(movie.title)))
            .map((movie, index) => ({
                movie,
                score: scoreMovie(movie, tasteProfile),
                index,
            }))
            .sort((a, b) => {
                if (b.score !== a.score) {
                    return b.score - a.score;
                }

                return a.index - b.index;
            })
            .map((entry) => entry.movie);

        const guaranteedFive = rankedPopularMovies.length >= 5
            ? rankedPopularMovies
            : rankedPopularMovies.concat(
                POPULAR_FALLBACK_TITLES
                    .map((title) => popularMovieMap.get(title))
                    .filter(Boolean)
                    .filter((movie) => !rankedPopularMovies.some((ranked) => ranked.title === movie.title))
            );

        return {
            movies: guaranteedFive.slice(0, 5),
            personalized: true,
        };
    }

    function requireSelectedMovie(documentRef) {
        const state = storage.loadAppState();
        if (!state.selectedMovie) {
            navigate("search.html", documentRef);
            return null;
        }
        return state.selectedMovie;
    }

    async function selectMovieAndOpen(title, documentRef) {
        const movie = await api.fetchMovieByTitle(title);
        if (!movie) {
            return false;
        }

        storage.setSelectedMovie(movie);
        navigate("movie.html", documentRef);
        return true;
    }

    async function handleAuthAction(action, username, password, successPath, documentRef) {
        const wasSuccessful = await action(username, password);
        if (!wasSuccessful) {
            return false;
        }

        storage.setLoggedIn(true);
        navigate(successPath, documentRef);
        return true;
    }

    function bindSignOut(documentRef) {
        const doc = documentRef || root.document;
        const signoutLink = doc.querySelector(".signout");
        if (!signoutLink) {
            return;
        }

        signoutLink.addEventListener("click", async (event) => {
            event.preventDefault();
            await api.logout();
            storage.clearAppState();
            navigate("signin.html", doc);
        });
    }

    function openSignin(documentRef) {
        const doc = documentRef || root.document;
        const signinButton = doc.querySelector("#signin");
        signinButton.addEventListener("click", async () => {
            const username = doc.querySelector("#username").value;
            const password = doc.querySelector("#password").value;
            await handleAuthAction(api.login, username, password, "mymovies.html", doc);
        });
    }

    function openSignup(documentRef) {
        const doc = documentRef || root.document;
        const createAccountButton = doc.querySelector("#createAccount");
        createAccountButton.addEventListener("click", async () => {
            const username = doc.querySelector("#newUsername").value;
            const password = doc.querySelector("#newPassword").value;
            await handleAuthAction(api.signup, username, password, "mymovies.html", doc);
        });
    }

    async function openMyMovies(documentRef) {
        const doc = documentRef || root.document;
        bindSignOut(doc);
        const [watchedMovies, activityFeed] = await Promise.all([
            api.fetchWatched(),
            api.fetchActivityFeed(25),
        ]);
        const entries = Object.entries(watchedMovies).map(([title, watchedValue]) => {
            const hasReviewObject = watchedValue && typeof watchedValue === "object";
            return {
                title,
                rating: hasReviewObject ? watchedValue.rating : watchedValue,
                review: hasReviewObject ? watchedValue.review || "" : "",
            };
        });

        await ui.renderMovieList({
            container: doc.querySelector("#moviesList"),
            entries,
            fetchPoster: api.fetchPosterByTitle,
            getPosterTitle: (entry) => entry.title,
            getLabel: (entry) => {
                const reviewSuffix = entry.review ? ` - \"${entry.review}\"` : "";
                return `   ${entry.title}; ${entry.rating} stars${reviewSuffix}`;
            },
            onSelect: async (entry) => {
                await selectMovieAndOpen(entry.title, doc);
            },
            documentRef: doc,
        });

        const feedItems = (Array.isArray(activityFeed) ? activityFeed : []).map((item) => {
            const username = item.username || "Someone";
            if (item.type === "rated_movie") {
                const reviewSuffix = item.review ? ` - \"${item.review}\"` : "";
                return `${username} rated ${item.movie} ${item.rating} stars${reviewSuffix}`;
            }
            if (item.type === "watchlist_added") {
                return `${username} added ${item.movie} to their watchlist`;
            }
            if (item.type === "watchlist_removed") {
                return `${username} removed ${item.movie} from their watchlist`;
            }
            return `${username} updated ${item.movie}`;
        });

        renderSimpleList(
            doc.querySelector("#activityFeed"),
            feedItems,
            "No activity yet. Follow users from Find a User to populate your feed.",
            doc
        );
    }

    async function openWatchlist(documentRef) {
        const doc = documentRef || root.document;
        bindSignOut(doc);
        const watchlist = await api.fetchWatchlist();
        const entries = watchlist.map((title) => ({ title }));

        await ui.renderMovieList({
            container: doc.querySelector("#moviesWatchList"),
            entries,
            fetchPoster: api.fetchPosterByTitle,
            getPosterTitle: (entry) => entry.title,
            getLabel: (entry) => `   ${entry.title}`,
            onSelect: async (entry) => {
                await selectMovieAndOpen(entry.title, doc);
            },
            documentRef: doc,
        });
    }

    async function openSearch(documentRef) {
        const doc = documentRef || root.document;
        bindSignOut(doc);
        
        const searchbox = doc.querySelector("#searchbox");
        const searchMenu = doc.querySelector("#searchMenu");
        const searchButton = doc.querySelector("#search");
        const searchStatus = doc.querySelector("#searchStatus");

        async function renderRecommendations() {
            const recommendations = await buildSearchRecommendations();

            if (searchStatus) {
                searchStatus.textContent = recommendations.personalized
                    ? "Recommended for you based on your watchlist and watched movies"
                    : "Popular movies to get you started";
            }

            await ui.renderSearchResults(
                searchMenu,
                recommendations.movies,
                async (movie) => {
                    await selectMovieAndOpen(movie.title, doc);
                },
                doc
            );
        }

        // Add event listener for live search as user types
        if (searchbox && searchMenu) {
            searchbox.addEventListener("input", async () => {
                const searchTerm = searchbox.value.trim();
                
                if (searchTerm.length === 0) {
                    await renderRecommendations();
                    return;
                }

                if (searchStatus) {
                    searchStatus.textContent = "Search results";
                }

                const results = await api.searchMovies(searchTerm);
                await ui.renderSearchResults(
                    searchMenu,
                    results,
                    async (movie) => {
                        await selectMovieAndOpen(movie.title, doc);
                    },
                    doc
                );
            });
        }

        await renderRecommendations();

        // Keep existing search button functionality
        searchButton.addEventListener("click", async () => {
            const searchedMovie = doc.querySelector("#searchbox").value;
            await selectMovieAndOpen(searchedMovie, doc);
        });
    }

    async function openMovie(documentRef) {
        const doc = documentRef || root.document;
        bindSignOut(doc);
        const movie = requireSelectedMovie(doc);
        if (!movie) {
            return;
        }
        let selectedRating = null;

        ui.updateMovieDetails(movie, doc);

        const watchedMovies = await api.fetchWatched();
        const watchedValue = watchedMovies[movie.title];
        const hasReviewObject = watchedValue && typeof watchedValue === "object";
        const initialRating = hasReviewObject ? Number(watchedValue.rating) : Number(watchedValue);
        const initialReview = hasReviewObject ? watchedValue.review || "" : "";

        if (!Number.isNaN(initialRating) && initialRating > 0) {
            selectedRating = initialRating;
        }

        const reviewTextElement = doc.querySelector("#written-review");
        if (reviewTextElement) {
            reviewTextElement.value = initialReview;
        }

        doc.querySelector("#addToList").addEventListener("click", async () => {
            const wasSuccessful = await api.addToWatchlist(movie.title);
            if (wasSuccessful) {
                navigate("watchlist.html", doc);
            }
        });

        ui.wireStarRating(doc.querySelectorAll(".image-button"), async (rating) => {
            selectedRating = rating;
        }, selectedRating);

        const saveReviewButton = doc.querySelector("#saveReview");
        if (!saveReviewButton) {
            return;
        }

        saveReviewButton.addEventListener("click", async () => {
            const reviewStatus = doc.querySelector("#review-status");
            if (!selectedRating) {
                if (reviewStatus) {
                    reviewStatus.textContent = "Select a star rating before saving your review.";
                }
                return;
            }

            const reviewText = reviewTextElement ? reviewTextElement.value.trim() : "";
            const wasSuccessful = await api.addToWatched(movie.title, selectedRating, reviewText);

            if (reviewStatus) {
                reviewStatus.textContent = wasSuccessful ? "Review saved." : "Could not save review.";
            }
        });
    }

    function buildRecentReviews(watched) {
        const watchedEntries = Object.entries(watched || {});
        return watchedEntries
            .filter(([, watchedValue]) => {
                const reviewText = watchedValue && typeof watchedValue === "object" ? watchedValue.review : "";
                return Boolean((reviewText || "").trim());
            })
            .reverse()
            .slice(0, 5)
            .map(([title, watchedValue]) => ({
                title,
                rating: watchedValue.rating,
                review: watchedValue.review,
            }));
    }

    function renderSimpleList(container, items, emptyText, documentRef) {
        const doc = documentRef || root.document;
        if (!container) {
            return;
        }

        container.innerHTML = "";
        if (!items || items.length === 0) {
            const emptyItem = doc.createElement("li");
            emptyItem.className = "empty-list-item";
            emptyItem.textContent = emptyText;
            container.appendChild(emptyItem);
            return;
        }

        items.forEach((itemText) => {
            const item = doc.createElement("li");
            item.textContent = itemText;
            container.appendChild(item);
        });
    }

    async function openFindUser(documentRef) {
        const doc = documentRef || root.document;
        bindSignOut(doc);

        const usernameInput = doc.querySelector("#findUserInput");
        const findUserButton = doc.querySelector("#findUserButton");
        const status = doc.querySelector("#findUserStatus");
        const suggestionsList = doc.querySelector("#findUserSuggestions");
        let latestSuggestionRequest = 0;

        if (!usernameInput || !findUserButton) {
            return;
        }

        function renderSuggestions(suggestions) {
            if (!suggestionsList) {
                return;
            }

            suggestionsList.innerHTML = "";
            if (!suggestions || suggestions.length === 0) {
                return;
            }

            suggestions.forEach((username) => {
                const item = doc.createElement("li");
                item.className = "user-suggestion-item";
                item.textContent = username;
                item.addEventListener("click", () => {
                    usernameInput.value = username;
                    suggestionsList.innerHTML = "";
                });
                suggestionsList.appendChild(item);
            });
        }

        usernameInput.addEventListener("input", async () => {
            const query = usernameInput.value.trim();
            const requestId = latestSuggestionRequest + 1;
            latestSuggestionRequest = requestId;

            if (!query) {
                renderSuggestions([]);
                return;
            }

            const suggestions = await api.fetchUserSuggestions(query);
            if (requestId !== latestSuggestionRequest) {
                return;
            }

            renderSuggestions(Array.isArray(suggestions) ? suggestions : []);
        });

        findUserButton.addEventListener("click", async () => {
            const username = usernameInput.value.trim();
            if (!username) {
                if (status) {
                    status.textContent = "Enter a username to search.";
                }
                return;
            }

            const response = await api.fetchUserProfile(username);
            if (!response || !response.found) {
                if (status) {
                    status.textContent = "User not found.";
                }
                return;
            }

            if (suggestionsList) {
                suggestionsList.innerHTML = "";
            }
            storage.setViewedUserProfile(response.profile.username);
            navigate("userprofile.html", doc);
        });
    }

    async function openUserProfile(documentRef) {
        const doc = documentRef || root.document;
        bindSignOut(doc);

        const viewedUsername = storage.getViewedUserProfile();
        if (!viewedUsername) {
            navigate("finduser.html", doc);
            return;
        }

        const response = await api.fetchUserProfile(viewedUsername);
        const usernameHeading = doc.querySelector("#profileUsername");
        const status = doc.querySelector("#profileStatus");
        const followButton = doc.querySelector("#followUserButton");
        const followStatus = doc.querySelector("#followUserStatus");

        if (!response || !response.found) {
            if (status) {
                status.textContent = "Could not load that user profile.";
            }
            return;
        }

        const profile = response.profile;
        if (usernameHeading) {
            usernameHeading.textContent = `${profile.username}'s Profile`;
        }
        if (status) {
            status.textContent = "";
        }

        let isFollowing = Boolean(response.isFollowing);
        const isSelf = Boolean(response.isSelf);
        if (followButton) {
            if (isSelf) {
                followButton.disabled = true;
                followButton.textContent = "This is you";
            } else {
                followButton.disabled = false;
                followButton.textContent = isFollowing ? "Unfollow" : "Follow";

                followButton.addEventListener("click", async () => {
                    const wasSuccessful = isFollowing
                        ? await api.unfollowUser(profile.username)
                        : await api.followUser(profile.username);

                    if (!wasSuccessful) {
                        if (followStatus) {
                            followStatus.textContent = "Could not update follow status.";
                        }
                        return;
                    }

                    isFollowing = !isFollowing;
                    followButton.textContent = isFollowing ? "Unfollow" : "Follow";
                    if (followStatus) {
                        followStatus.textContent = isFollowing
                            ? `You are now following ${profile.username}.`
                            : `You unfollowed ${profile.username}.`;
                    }
                });
            }
        }

        if (followStatus && isSelf) {
            followStatus.textContent = "";
        }

        const watchedEntries = Object.entries(profile.watched || {}).map(([title, watchedValue]) => {
            const hasReviewObject = watchedValue && typeof watchedValue === "object";
            const rating = hasReviewObject ? watchedValue.rating : watchedValue;
            const review = hasReviewObject ? watchedValue.review || "" : "";
            const reviewSuffix = review ? ` - \"${review}\"` : "";
            return `${title}; ${rating} stars${reviewSuffix}`;
        });

        const recentReviews = buildRecentReviews(profile.watched || {}).map(
            (entry) => `${entry.title}; ${entry.rating} stars - \"${entry.review}\"`
        );

        renderSimpleList(
            doc.querySelector("#profileWatchlist"),
            profile.watchlist || [],
            "No watchlist movies yet.",
            doc
        );

        renderSimpleList(
            doc.querySelector("#profileWatched"),
            watchedEntries,
            "No watched movies yet.",
            doc
        );

        renderSimpleList(
            doc.querySelector("#profileRecentReviews"),
            recentReviews,
            "No recent written reviews yet.",
            doc
        );
    }

    return {
        bindSignOut,
        handleAuthAction,
        navigate,
        openSignin,
        openSignup,
        openMyMovies,
        openWatchlist,
        openSearch,
        openMovie,
        openFindUser,
        openUserProfile,
        requireSelectedMovie,
        selectMovieAndOpen,
    };
});
