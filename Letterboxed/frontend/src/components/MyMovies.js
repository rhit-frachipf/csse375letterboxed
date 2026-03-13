import React, { useEffect, useState } from 'react';
import Movie from './Movie';

const MyMovies = () => {
  const [movies, setMovies] = useState([]);

  useEffect(() => {
    const fetchMovies = async () => {
      const response = await fetch('http://localhost:5000/api/movies');
      const data = await response.json();
      setMovies(data);
    };
    fetchMovies();
  }, []);

  return (
    <div>
      <h2>Watched Movies</h2>
      {movies.map((movie, index) => (
        <Movie key={index} {...movie} />
      ))}
    </div>
  );
};

export default MyMovies;
