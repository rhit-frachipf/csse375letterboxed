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

    function wireStarRating(stars, onRate) {
        Array.from(stars).forEach((star, index) => {
            star.addEventListener("mouseenter", () => {
                for (let currentIndex = 0; currentIndex <= index; currentIndex += 1) {
                    stars[currentIndex].classList.add("gold");
                }
            });

            star.addEventListener("mouseleave", () => {
                Array.from(stars).forEach((currentStar) => currentStar.classList.remove("gold"));
            });

            star.addEventListener("click", () => onRate(index + 1));
        });
    }

    return {
        renderMovieList,
        updateMovieDetails,
        wireStarRating,
    };
});
