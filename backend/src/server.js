require('dotenv').config();
const express = require('express');
const cors = require('cors');

const { runMigrations }  = require('./migrations/run');
const authRoutes      = require('./routes/auth');
const adminAuthRoutes = require('./routes/adminAuth');
const materialsRoutes = require('./routes/materials');
const projectsRoutes  = require('./routes/projects');
const estimatesRoutes = require('./routes/estimates');
const uploadsRoutes   = require('./routes/uploads');

const app = express();
const PORT = process.env.PORT || 3001;

const ALLOWED_ORIGINS = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim());

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return res.status(403).json({ error: 'CORS: origin not allowed' });
  }
  next();
});

app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
app.use(express.json());

app.use('/api/auth',       authRoutes);
app.use('/api/admin/auth', adminAuthRoutes);
app.use('/api/materials',  materialsRoutes);
app.use('/api/projects',   projectsRoutes);
app.use('/api/estimates',  estimatesRoutes);
app.use('/api/uploads',    uploadsRoutes);
// Nested project→estimate creation route: POST /api/projects/:id/estimates
app.use('/api',            estimatesRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

runMigrations()
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('Startup migration failed:', err.message);
    process.exit(1);
  });

module.exports = app;
