username = null
movies = []
movietitle = null
moviegenre = null
movieyear = null
movieplot = null
movieposter = null
loggedin = false

window.addEventListener("load", (event) => {    
    loadvars()
    console.log("page is fully loaded")
    console.log("sign in status: ", loggedin)
});


function opensignin(){
    document.querySelector("#signin").addEventListener("click", () => {
        let usernameString = document.querySelector("#username").value
        let passwordString = document.querySelector("#password").value
        signIn(usernameString, passwordString)
    })
}

function opensignup(){
    document.querySelector("#createAccount").addEventListener("click", () => {
        let usernameString = document.querySelector("#newUsername").value
        let passwordString = document.querySelector("#newPassword").value
        signUp(usernameString, passwordString)
    })
}

function openmymovies(){
    document.querySelector(".signout").addEventListener("click", () => {
        loggedin = false
        savevars()
        console.log("signed out")
    })

    const movieList = document.querySelector("#moviesList")

    async function fetchMovies() {
        try {
            const response = await fetch('/get-watched');
            const data = await response.json();
            console.log("data: ", data);
    
            for (const movie in data) {
                const image = document.createElement('img');
                const listItem = document.createElement('li');
    
                const posterUrl = await returnPosterByTitle(movie);
                console.log(posterUrl);
    
                if (posterUrl) {
                    image.src = posterUrl;
                } else {
                    image.src = "../noimage.png";
                }
    
                image.alt = `${movie} image`
                image.style.width = '30px'
                image.style.height = '30px'
                image.style.borderRadius = '50%'
                image.style.border = '1px solid black'
    
                listItem.appendChild(image);
    
                const textNode = document.createTextNode(`   ${movie}; ${data[movie]} stars`);
                listItem.appendChild(textNode);
    
                listItem.addEventListener("click", () => { fetchMovieByTitle(movie) });
    
                movieList.appendChild(listItem);
            }
        } catch (error) {
            console.error('Error fetching movies:', error);
        }
    }
    
    fetchMovies();
}

function openwatchlist(){
    document.querySelector(".signout").addEventListener("click", () => {
        loggedin = false
        savevars()
        console.log("signed out")
    })

    const movieList = document.querySelector("#moviesWatchList")

    async function fetchMovies() {
        try {
            const response = await fetch('/get-watchlist');
            const data = await response.json();
            console.log("data: ", data);
    
            for (const movie in data) {
                const image = document.createElement('img');
                const listItem = document.createElement('li');
    
                const posterUrl = await returnPosterByTitle(data[movie]);
                console.log(posterUrl);
    
                if (posterUrl) {
                    image.src = posterUrl;
                } else {
                    image.src = "../noimage.png";
                }
    
                image.alt = `${data[movie]} image`;
                image.style.width = '30px';
                image.style.height = '30px';
                image.style.borderRadius = '50%';
                image.style.border = '1px solid black';
    
                listItem.appendChild(image);
    
                const textNode = document.createTextNode("   " + data[movie]);
                listItem.appendChild(textNode);
    
                listItem.addEventListener("click", () => { fetchMovieByTitle(data[movie]) });
    
                movieList.appendChild(listItem);
            }
        } catch (error) {
            console.error('Error fetching movies:', error);
        }
    }
    
    fetchMovies();
}

function opensearch(){
    document.querySelector("#search").addEventListener("click", () => {
        let searchedmovie = document.querySelector("#searchbox").value
        fetchMovieByTitle(searchedmovie)
    })
}

function openmovie(){
    document.querySelector("#movie-title").innerHTML = movietitle;
    document.querySelector("#movie-genre").innerHTML = moviegenre;
    document.querySelector("#movie-plot").innerHTML = movieplot;
    document.querySelector("#movie-year").innerHTML = movieyear;
    console.log(movieposter)
    document.querySelector("#movie-poster").src = movieposter;
    document.querySelector("#addToList").addEventListener("click", () => {
        addToWatchList(username, movietitle)
    })

    const stars = document.querySelectorAll('.image-button');

    stars.forEach((star, index) => {
      star.addEventListener('mouseenter', () => {
        for (let i = 0; i <= index; i++) {
          stars[i].classList.add('gold');
        }
      });

      star.addEventListener('mouseleave', () => {
        stars.forEach(star => star.classList.remove('gold'));
      });

      star.addEventListener("click", () => {
        addToWatched(username, movietitle, index + 1)
      })
    });
}

async function addToWatchList(user, title){
    let currentData = {"username": user, "movie": title}
    const urlEncodedData = new URLSearchParams(currentData).toString();

    let response = await fetch("/add-to-watchlist", {
        method: "POST",
        headers: {
            "Content-Type": 'application/x-www-form-urlencoded'
        },
        body: urlEncodedData
        }
    )

    let responseText = await response.text()
    console.log(responseText);
    
    if (responseText === "true"){
        document.location.href = "watchlist.html"
    }
}

async function addToWatched(user, title, rating){
    let currentData = {"username": user, "movie": title, "rating": rating}
    const urlEncodedData = new URLSearchParams(currentData).toString();

    let response = await fetch("/add-to-watched", {
        method: "POST",
        headers: {
            "Content-Type": 'application/x-www-form-urlencoded'
        },
        body: urlEncodedData
        }
    )
} 

async function signIn(name, pass) {
    let currentData = {"username": name, "password": pass}
    const urlEncodedData = new URLSearchParams(currentData).toString();

    let response = await fetch("/API/LOGIN", {
        method: "POST",
        headers: {
            "Content-Type": 'application/x-www-form-urlencoded'
        },
        body: urlEncodedData
        }
    )

    let responseText = await response.text()
    console.log(responseText);
    
    if (responseText === "true"){
        console.log("SIGN IN TRUE")
        loggedin = true
        savevars()
        document.location.href = "mymovies.html"
    }
}

async function signUp(name, pass) {
    let currentData = {"username": name, "password": pass, "loggedin": loggedin}
    const urlEncodedData = new URLSearchParams(currentData).toString();

    let response = await fetch("/API/SIGNUP", {
        method: "POST",
        headers: {
            "Content-Type": 'application/x-www-form-urlencoded'
        },
        body: urlEncodedData
        }
    )

    let responseText = await response.text()
    console.log(responseText);
    
    if (responseText === "true"){
        document.location.href = "mymovies.html"
    }
}

async function returnPosterByTitle(title) {
    const apiKey = '10707b46'
    const url = `http://www.omdbapi.com/?t=${encodeURIComponent(title)}&apikey=${apiKey}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.Response === "True") {
            return data.Poster;
        } else {
            console.log("Error:", data.Error);
            return false
        }
    } catch (error) {
        console.error("Error fetching movie:", error);
    }
    return false
}

// url for searched movies (ones that start with the), not single movie:
// https://www.omdbapi.com/?s=$the&apikey=10707b46

async function fetchMovieByTitle(title) {
    const apiKey = '10707b46'
    const url = `http://www.omdbapi.com/?t=${encodeURIComponent(title)}&apikey=${apiKey}`;
    const posterUrl = `http://img.omdbapi.com/?t=${encodeURIComponent(title)}&apikey=${apiKey}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.Response === "True") {
            console.log("Movie Title:", data.Title);
            console.log("Year:", data.Year);
            console.log("Plot:", data.Plot);
            console.log("Poster:", data.Poster);
            console.log("Ratings:", data.Ratings);
            movietitle = data.Title;
            movieyear = data.Year;
            movieplot = data.Plot;
            moviegenre = data.Genre;
            movieposter = data.Poster;
            savevars()
            document.location.href = "movie.html"
        } else {
            console.log("Error:", data.Error);
            
        }
    } catch (error) {
        console.error("Error fetching movie:", error);
    }

}

function savevars(){
    localStorage.setItem('loggedin', loggedin)
    localStorage.setItem('movietitle', movietitle)
    localStorage.setItem('moviegenre', moviegenre)
    localStorage.setItem('movieyear', movieyear)
    localStorage.setItem('movieplot', movieplot)
    localStorage.setItem('movieposter', movieposter)
    console.log("vars saved: ", loggedin, movietitle, moviegenre, movieyear, movieplot, movieposter)
}

function loadvars(){
    loggedin = localStorage.getItem('loggedin')
    movietitle = localStorage.getItem('movietitle')
    moviegenre = localStorage.getItem('moviegenre')
    movieyear = localStorage.getItem('movieyear')
    movieplot = localStorage.getItem('movieplot')
    movieposter = localStorage.getItem('movieposter')
    console.log("vars loaded: ", loggedin, movietitle, moviegenre, movieyear, movieplot, movieposter)
}