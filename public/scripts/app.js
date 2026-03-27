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
    function navigate(path, documentRef) {
        const doc = documentRef || root.document;
        doc.location.href = path;
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
        const watchedMovies = await api.fetchWatched();
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

    function openSearch(documentRef) {
        const doc = documentRef || root.document;
        bindSignOut(doc);
        const searchButton = doc.querySelector("#search");
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
        requireSelectedMovie,
        selectMovieAndOpen,
    };
});
