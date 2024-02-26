import express from 'express';
const app = express();
const port = 3000;

app.get('/', (req, res) => {
  res.send('');
});

app.listen(port, () => {
  return console.log(`fractal-data is listening at http://localhost:${port}`);
});
