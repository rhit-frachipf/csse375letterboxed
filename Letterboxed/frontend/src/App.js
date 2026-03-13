import React from 'react';
import Navbar from '/components/Navbar';
import SignIn from '/components/SignIn';
import SignUp from '/components/SignUp';
import MyMovies from '/components/MyMovies';
import Watchlist from '/components/Watchlist';
import Search from '/components/Search';

function App() {
  return (
    <div>
      <Navbar />
      {/* You can use React Router here to switch between components */}
      <SignIn />
      <SignUp />
      <MyMovies />
      <Watchlist />
      <Search />
    </div>
  );
}

export default App;
