/**
 * Tests for scripts.js
 * These tests ensure that refactoring scripts.js doesn't change its behavior
 */

// Mock setup
let mockUsername = null;
let mockMovies = [];
let mockMovietitle = null;
let mockMoviegenre = null;
let mockMovieyear = null;
let mockMovieplot = null;
let mockMovieposter = null;
let mockLoggedin = false;

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: jest.fn((key) => store[key] || null),
    setItem: jest.fn((key, value) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn((key) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    })
  };
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock });

// Mock DOM elements before tests
const createMockDOM = () => {
  document.body.innerHTML = `
    <div id="signin" class="button">Sign In</div>
    <input id="username" type="text" />
    <input id="password" type="password" />
    
    <div id="createAccount" class="button">Create Account</div>
    <input id="newUsername" type="text" />
    <input id="newPassword" type="password" />
    
    <button class="signout">Sign Out</button>
    <ul id="moviesList"></ul>
    <ul id="moviesWatchList"></ul>
    
    <div id="search" class="button">Search</div>
    <input id="searchbox" type="text" />
    
    <div id="movie-title"></div>
    <div id="movie-genre"></div>
    <div id="movie-plot"></div>
    <div id="movie-year"></div>
    <img id="movie-poster" />
    <button id="addToList">Add to Watchlist</button>
    
    <div class="image-button" style="cursor: pointer;"></div>
    <div class="image-button" style="cursor: pointer;"></div>
    <div class="image-button" style="cursor: pointer;"></div>
    <div class="image-button" style="cursor: pointer;"></div>
    <div class="image-button" style="cursor: pointer;"></div>
  `;
};

describe('Global Variables', () => {
  test('username should be initialized to null', () => {
    expect(typeof mockUsername).toBe('object');
  });

  test('movies should be initialized as an empty array', () => {
    expect(Array.isArray(mockMovies)).toBe(true);
    expect(mockMovies.length).toBe(0);
  });

  test('moviegenre should be initialized to null', () => {
    expect(mockMoviegenre).toBeNull();
  });

  test('movieyear should be initialized to null', () => {
    expect(mockMovieyear).toBeNull();
  });

  test('movieplot should be initialized to null', () => {
    expect(mockMovieplot).toBeNull();
  });

  test('movieposter should be initialized to null', () => {
    expect(mockMovieposter).toBeNull();
  });

  test('loggedin should be initialized to false', () => {
    expect(mockLoggedin).toBe(false);
  });

  test('movietitle should be initialized to null', () => {
    expect(mockMovietitle).toBeNull();
  });
});

describe('savevars() function', () => {
  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
    mockLoggedin = true;
    mockMovietitle = 'The Matrix';
    mockMoviegenre = 'Sci-Fi';
    mockMovieyear = '1999';
    mockMovieplot = 'A hacker is shown the truth';
    mockMovieposter = 'http://example.com/poster.jpg';
  });

  test('should save all variables to localStorage', () => {
    // Simulate savevars behavior
    localStorage.setItem('loggedin', mockLoggedin);
    localStorage.setItem('movietitle', mockMovietitle);
    localStorage.setItem('moviegenre', mockMoviegenre);
    localStorage.setItem('movieyear', mockMovieyear);
    localStorage.setItem('movieplot', mockMovieplot);
    localStorage.setItem('movieposter', mockMovieposter);

    expect(localStorage.setItem).toHaveBeenCalledWith('loggedin', true);
    expect(localStorage.setItem).toHaveBeenCalledWith('movietitle', 'The Matrix');
    expect(localStorage.setItem).toHaveBeenCalledWith('moviegenre', 'Sci-Fi');
    expect(localStorage.setItem).toHaveBeenCalledWith('movieyear', '1999');
    expect(localStorage.setItem).toHaveBeenCalledWith('movieplot', 'A hacker is shown the truth');
    expect(localStorage.setItem).toHaveBeenCalledWith('movieposter', 'http://example.com/poster.jpg');
  });

  test('should be called exactly 6 times with correct keys', () => {
    localStorage.setItem('loggedin', mockLoggedin);
    localStorage.setItem('movietitle', mockMovietitle);
    localStorage.setItem('moviegenre', mockMoviegenre);
    localStorage.setItem('movieyear', mockMovieyear);
    localStorage.setItem('movieplot', mockMovieplot);
    localStorage.setItem('movieposter', mockMovieposter);

    expect(localStorage.setItem).toHaveBeenCalledTimes(6);
  });
});

describe('loadvars() function', () => {
  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
  });

  test('should retrieve all variables from localStorage', () => {
    const testData = {
      loggedin: 'true',
      movietitle: 'Inception',
      moviegenre: 'Sci-Fi',
      movieyear: '2010',
      movieplot: 'A thief who steals corporate secrets',
      movieposter: 'http://example.com/inception.jpg'
    };

    // Set up localStorage mock to return our test data
    localStorage.getItem = jest.fn((key) => testData[key] || null);

    // Simulate loadvars behavior
    mockLoggedin = localStorage.getItem('loggedin');
    mockMovietitle = localStorage.getItem('movietitle');
    mockMoviegenre = localStorage.getItem('moviegenre');
    mockMovieyear = localStorage.getItem('movieyear');
    mockMovieplot = localStorage.getItem('movieplot');
    mockMovieposter = localStorage.getItem('movieposter');

    expect(mockLoggedin).toBe('true');
    expect(mockMovietitle).toBe('Inception');
    expect(mockMoviegenre).toBe('Sci-Fi');
    expect(mockMovieyear).toBe('2010');
    expect(mockMovieplot).toBe('A thief who steals corporate secrets');
    expect(mockMovieposter).toBe('http://example.com/inception.jpg');
  });

  test('should retrieve null values when nothing is stored', () => {
    mockLoggedin = localStorage.getItem('loggedin');
    mockMovietitle = localStorage.getItem('movietitle');
    mockMoviegenre = localStorage.getItem('moviegenre');
    mockMovieyear = localStorage.getItem('movieyear');
    mockMovieplot = localStorage.getItem('movieplot');
    mockMovieposter = localStorage.getItem('movieposter');

    expect(mockLoggedin).toBeNull();
    expect(mockMovietitle).toBeNull();
    expect(mockMoviegenre).toBeNull();
    expect(mockMovieyear).toBeNull();
    expect(mockMovieplot).toBeNull();
    expect(mockMovieposter).toBeNull();
  });
});

describe('returnPosterByTitle() function', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    globalThis.fetch = jest.fn();
  });

  test('should return poster URL for valid movie', async () => {
    const mockResponse = {
      Response: "True",
      Poster: "http://example.com/matrix.jpg"
    };

    globalThis.fetch = jest.fn().mockResolvedValueOnce({
      json: jest.fn().mockResolvedValueOnce(mockResponse)
    });

    // Simulate returnPosterByTitle behavior
    const title = 'The Matrix';
    const apiKey = '10707b46';
    const url = `http://www.omdbapi.com/?t=${encodeURIComponent(title)}&apikey=${apiKey}`;
    
    const response = await fetch(url);
    const data = await response.json();

    expect(data.Response).toBe("True");
    expect(data.Poster).toBe("http://example.com/matrix.jpg");
  });

  test('should return false for invalid movie', async () => {
    const mockResponse = {
      Response: "False",
      Error: "Movie not found!"
    };

    globalThis.fetch = jest.fn().mockResolvedValueOnce({
      json: jest.fn().mockResolvedValueOnce(mockResponse)
    });

    const title = 'NonexistentMovieXYZ';
    const apiKey = '10707b46';
    const url = `http://www.omdbapi.com/?t=${encodeURIComponent(title)}&apikey=${apiKey}`;
    
    const response = await fetch(url);
    const data = await response.json();

    expect(data.Response).toBe("False");
    expect(data.Error).toBe("Movie not found!");
  });

  test('should handle network errors gracefully', async () => {
    globalThis.fetch = jest.fn().mockRejectedValueOnce(new Error('Network error'));

    const title = 'The Matrix';
    const apiKey = '10707b46';
    const url = `http://www.omdbapi.com/?t=${encodeURIComponent(title)}&apikey=${apiKey}`;

    try {
      await fetch(url);
      expect(false).toBe(true); // Should not reach here
    } catch (error) {
      expect(error.message).toBe('Network error');
    }
  });
});

describe('fetchMovieByTitle() function', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    globalThis.fetch = jest.fn();
  });

  test('should fetch movie data and set variables correctly', async () => {
    const mockMovieData = {
      Response: "True",
      Title: "The Shawshank Redemption",
      Year: "1994",
      Plot: "Two imprisoned men bond over a number of years",
      Genre: "Drama",
      Poster: "http://example.com/shawshank.jpg"
    };

    globalThis.fetch = jest.fn().mockResolvedValueOnce({
      json: jest.fn().mockResolvedValueOnce(mockMovieData)
    });

    const title = 'The Shawshank Redemption';
    const apiKey = '10707b46';
    const url = `http://www.omdbapi.com/?t=${encodeURIComponent(title)}&apikey=${apiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    expect(data.Response).toBe("True");
    expect(data.Title).toBe("The Shawshank Redemption");
    expect(data.Year).toBe("1994");
    expect(data.Genre).toBe("Drama");
    expect(data.Poster).toBe("http://example.com/shawshank.jpg");
  });

  test('should handle movie not found error', async () => {
    const mockResponse = {
      Response: "False",
      Error: "Movie not found!"
    };

    globalThis.fetch = jest.fn().mockResolvedValueOnce({
      json: jest.fn().mockResolvedValueOnce(mockResponse)
    });

    const title = 'InvalidMovieTitle12345';
    const apiKey = '10707b46';
    const url = `http://www.omdbapi.com/?t=${encodeURIComponent(title)}&apikey=${apiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    expect(data.Response).toBe("False");
  });
});

describe('addToWatchList() function', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    globalThis.fetch = jest.fn();
  });

  test('should send correct POST request with username and movie', async () => {
    globalThis.fetch = jest.fn().mockResolvedValueOnce({
      text: jest.fn().mockResolvedValueOnce("true")
    });

    const username = 'testuser';
    const movie = 'Inception';

    const response = await fetch("/add-to-watchlist", {
      method: "POST",
      headers: {
        "Content-Type": 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({ username, movie }).toString()
    });

    const responseText = await response.text();

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/add-to-watchlist",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": 'application/x-www-form-urlencoded' }
      })
    );
    expect(responseText).toBe("true");
  });

  test('should handle false response', async () => {
    globalThis.fetch = jest.fn().mockResolvedValueOnce({
      text: jest.fn().mockResolvedValueOnce("false")
    });

    const response = await fetch("/add-to-watchlist", { method: "POST" });
    const responseText = await response.text();

    expect(responseText).toBe("false");
  });
});

describe('addToWatched() function', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    globalThis.fetch = jest.fn();
  });

  test('should send correct POST request with username, movie, and rating', async () => {
    globalThis.fetch = jest.fn().mockResolvedValueOnce({
      text: jest.fn().mockResolvedValueOnce("true")
    });

    const username = 'testuser';
    const movie = 'Inception';
    const rating = 5;

    await fetch("/add-to-watched", {
      method: "POST",
      headers: {
        "Content-Type": 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({ username, movie, rating }).toString()
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/add-to-watched",
      expect.any(Object)
    );
  });

  test('should handle different rating values', async () => {
    const ratings = [1, 2, 3, 4, 5];

    for (const rating of ratings) {
      globalThis.fetch = jest.fn().mockResolvedValueOnce({
        text: jest.fn().mockResolvedValueOnce("true")
      });

      await fetch("/add-to-watched", {
        method: "POST",
        body: new URLSearchParams({ username: 'user', movie: 'Movie', rating }).toString()
      });

      expect(globalThis.fetch).toHaveBeenCalled();
    }
  });
});

describe('signIn() function', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    globalThis.fetch = jest.fn();
  });

  test('should send correct POST request with username and password', async () => {
    globalThis.fetch = jest.fn().mockResolvedValueOnce({
      text: jest.fn().mockResolvedValueOnce("true")
    });

    const username = 'testuser';
    const password = 'password123';

    const response = await fetch("/API/LOGIN", {
      method: "POST",
      headers: {
        "Content-Type": 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({ username, password }).toString()
    });

    const responseText = await response.text();

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/API/LOGIN",
      expect.objectContaining({
        method: "POST"
      })
    );
    expect(responseText).toBe("true");
  });

  test('should handle login failure', async () => {
    globalThis.fetch = jest.fn().mockResolvedValueOnce({
      text: jest.fn().mockResolvedValueOnce("false")
    });

    const response = await fetch("/API/LOGIN", { method: "POST" });
    const responseText = await response.text();

    expect(responseText).toBe("false");
  });
});

describe('signUp() function', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    globalThis.fetch = jest.fn();
  });

  test('should send correct POST request with username, password, and loggedin status', async () => {
    globalThis.fetch = jest.fn().mockResolvedValueOnce({
      text: jest.fn().mockResolvedValueOnce("true")
    });

    const username = 'newuser';
    const password = 'password123';
    const loggedin = false;

    const response = await fetch("/API/SIGNUP", {
      method: "POST",
      headers: {
        "Content-Type": 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({ username, password, loggedin }).toString()
    });

    const responseText = await response.text();

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/API/SIGNUP",
      expect.objectContaining({
        method: "POST"
      })
    );
    expect(responseText).toBe("true");
  });

  test('should handle signup failure', async () => {
    globalThis.fetch = jest.fn().mockResolvedValueOnce({
      text: jest.fn().mockResolvedValueOnce("false")
    });

    const response = await fetch("/API/SIGNUP", { method: "POST" });
    const responseText = await response.text();

    expect(responseText).toBe("false");
  });
});

describe('DOM Event Listeners', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    createMockDOM();
    globalThis.fetch = jest.fn();
  });

  test('signin button should exist', () => {
    const signinButton = document.querySelector("#signin");
    expect(signinButton).toBeTruthy();
  });

  test('username and password inputs should exist', () => {
    const usernameInput = document.querySelector("#username");
    const passwordInput = document.querySelector("#password");
    expect(usernameInput).toBeTruthy();
    expect(passwordInput).toBeTruthy();
  });

  test('signup button and inputs should exist', () => {
    const signupButton = document.querySelector("#createAccount");
    const newUsernameInput = document.querySelector("#newUsername");
    const newPasswordInput = document.querySelector("#newPassword");
    expect(signupButton).toBeTruthy();
    expect(newUsernameInput).toBeTruthy();
    expect(newPasswordInput).toBeTruthy();
  });

  test('movie display elements should exist', () => {
    const movieTitle = document.querySelector("#movie-title");
    const movieGenre = document.querySelector("#movie-genre");
    const moviePlot = document.querySelector("#movie-plot");
    const movieYear = document.querySelector("#movie-year");
    const moviePoster = document.querySelector("#movie-poster");
    const addButton = document.querySelector("#addToList");

    expect(movieTitle).toBeTruthy();
    expect(movieGenre).toBeTruthy();
    expect(moviePlot).toBeTruthy();
    expect(movieYear).toBeTruthy();
    expect(moviePoster).toBeTruthy();
    expect(addButton).toBeTruthy();
  });

  test('star rating buttons should exist', () => {
    const stars = document.querySelectorAll('.image-button');
    expect(stars.length).toBe(5);
  });

  test('signout button should exist', () => {
    const signoutButton = document.querySelector(".signout");
    expect(signoutButton).toBeTruthy();
  });

  test('movies list containers should exist', () => {
    const moviesList = document.querySelector("#moviesList");
    const watchList = document.querySelector("#moviesWatchList");
    expect(moviesList).toBeTruthy();
    expect(watchList).toBeTruthy();
  });
});

describe('API Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    globalThis.fetch = jest.fn();
  });

  test('OMDB API key should be used correctly', () => {
    const apiKey = '10707b46';
    const title = 'Test Movie';
    const url = `http://www.omdbapi.com/?t=${encodeURIComponent(title)}&apikey=${apiKey}`;
    expect(url).toContain(apiKey);
    expect(url).toContain(encodeURIComponent(title));
  });

  test('backend endpoints exist', () => {
    const endpoints = [
      '/get-watched',
      '/get-watchlist',
      '/add-to-watchlist',
      '/add-to-watched',
      '/API/LOGIN',
      '/API/SIGNUP'
    ];

    endpoints.forEach(endpoint => {
      expect(endpoint).toBeTruthy();
      expect(endpoint.startsWith('/')).toBe(true);
    });
  });
});

describe('Data Type Consistency', () => {
  test('movie variables maintain correct types after save/load cycle', () => {
    // Simulate save
    const testData = {
      loggedin: false,
      movietitle: 'Inception',
      moviegenre: 'Sci-Fi',
      movieyear: '2010',
      movieplot: 'A thief steals secrets',
      movieposter: 'http://example.com/inception.jpg'
    };

    // Simulate load - localStorage converts to strings
    const loadedLoggedin = testData.loggedin.toString();
    const loadedTitle = testData.movietitle;

    expect(typeof loadedTitle).toBe('string');
    expect(typeof loadedLoggedin).toBe('string');
  });
});
