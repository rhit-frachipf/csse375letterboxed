(function (root, factory) {
    if (typeof module === "object" && module.exports) {
        module.exports = factory(root);
    } else {
        root.LetterboxUi = factory(root);
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
    function applyPosterImage(image, posterUrl) {
        image.src = posterUrl || "../noimage.png";
        image.style.width = "30px";
        image.style.height = "30px";
        image.style.borderRadius = "50%";
        image.style.border = "1px solid black";
    }

    async function renderMovieList(options) {
        const {
            container,
            entries,
            fetchPoster,
            getPosterTitle,
            getLabel,
            onSelect,
            documentRef,
        } = options;
        const doc = documentRef || root.document;

        container.innerHTML = "";

        for (const entry of entries) {
            const image = doc.createElement("img");
            const listItem = doc.createElement("li");
            const title = getPosterTitle(entry);
            const posterUrl = await fetchPoster(title);

            applyPosterImage(image, posterUrl);
            image.alt = `${title} image`;
            listItem.appendChild(image);
            listItem.appendChild(doc.createTextNode(getLabel(entry)));
            listItem.addEventListener("click", () => onSelect(entry));
            container.appendChild(listItem);
        }
    }

    function updateMovieDetails(movie, documentRef) {
        const doc = documentRef || root.document;
        doc.querySelector("#movie-title").textContent = movie.title;
        doc.querySelector("#movie-genre").textContent = movie.genre;
        doc.querySelector("#movie-plot").textContent = movie.plot;
        doc.querySelector("#movie-year").textContent = movie.year;
        doc.querySelector("#movie-poster").src = movie.poster;
    }

    function wireStarRating(stars, onRate, initialRating) {
        const starArray = Array.from(stars);
        const safeInitialRating = Number(initialRating);
        let selectedIndex = Number.isNaN(safeInitialRating) || safeInitialRating < 1 ? -1 : safeInitialRating - 1;

        function renderSelection(highlightIndex) {
            starArray.forEach((currentStar, currentIndex) => {
                if (currentIndex <= highlightIndex) {
                    currentStar.classList.add("gold");
                } else {
                    currentStar.classList.remove("gold");
                }
            });
        }

        renderSelection(selectedIndex);

        starArray.forEach((star, index) => {
            star.addEventListener("mouseenter", () => {
                renderSelection(index);
            });

            star.addEventListener("mouseleave", () => {
                renderSelection(selectedIndex);
            });

            star.addEventListener("click", () => {
                selectedIndex = index;
                renderSelection(selectedIndex);
                onRate(index + 1);
            });
        });
    }

    return {
        renderMovieList,
        updateMovieDetails,
        wireStarRating,
    };
});
