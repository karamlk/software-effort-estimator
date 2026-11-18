import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import estimationRouter from './routes/estimation.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/estimation', estimationRouter);

app.use((err, req, res, _next) => {
  console.error('[api error]', err);
  res.status(err.status || 500).json({
    code: err.status || 500,
    message: err.message || 'Internal server error',
  });
});

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`[api] listening on http://${HOST}:${PORT}`);
});
