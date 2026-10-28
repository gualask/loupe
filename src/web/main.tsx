import { render } from 'preact';
import { App } from './App.tsx';
import { loadSession, watchSession } from './lib/session.ts';
import './styles.css';

void loadSession();
watchSession();

const root = document.getElementById('app');
if (root) render(<App />, root);
