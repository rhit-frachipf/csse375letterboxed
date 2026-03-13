import React from 'react';

const Movie = ({ title, year, genre }) => (
  <div>
    <h3>{title}</h3>
    <p>{year}</p>
    <p>{genre}</p>
  </div>
);

export default Movie;
