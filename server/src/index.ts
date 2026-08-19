import express from 'express';
import path from 'node:path';
import kioskRoutes from './routes/kiosk.js';
import adminRoutes from './routes/admin.js';
import signupRoutes from './routes/signups.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // behind Coolify's reverse proxy
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});
app.use('/api/kiosk', kioskRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', signupRoutes);

// Serve the built React app; SPA fallback for client-side routes like /admin.
const webDist = path.resolve(import.meta.dirname, '../../web/dist');
app.use(express.static(webDist));
app.get(/^\/(?!api\/).*/, (_req, res) => {
  res.sendFile(path.join(webDist, 'index.html'));
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`♻️  Recycling Time Clock listening on http://localhost:${port}`);
});
