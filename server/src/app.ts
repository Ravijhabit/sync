import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import passport from 'passport';

import healthRouter from './routes/health';
import authRouter from './routes/auth';
import authGoogleRouter from './routes/authGoogle';
import usersRouter from './routes/users';
import eventsRouter from './routes/events';
import learningsRouter from './routes/learnings';
import matchesRouter from './routes/matches';
import telemetryRouter from './routes/telemetry';
import { errorHandler } from './middleware/errorHandler';
import { configurePassport } from './middleware/passport';

configurePassport();

const app = express();

app.use(
  cors({
    origin: process.env['CLIENT_URL'],
    credentials: true,
  })
);
app.use(helmet());
app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());

app.use('/api', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/auth', authGoogleRouter);
app.use('/api/users', usersRouter);
app.use('/api/events', eventsRouter);
app.use('/api/learnings', learningsRouter);
app.use('/api/matches', matchesRouter);
app.use('/api/telemetry', telemetryRouter);

app.use(errorHandler);

export default app;
