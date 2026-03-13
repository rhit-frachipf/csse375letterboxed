import React from 'react';
import './styles.css';

const Navbar = () => (
  <nav className="nav-bar">
    <a className="mymovies" href="/mymovies">My Movies</a>
    <a className="watchlist" href="/watchlist">Watchlist</a>
    <a className="search" href="/search">Search</a>
    <a className="signout" href="/signin">Sign Out</a>
  </nav>
);

export default Navbar;
