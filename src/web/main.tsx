import { render } from 'preact';
import { App } from './App.tsx';
import { currentUser, loadSession } from './lib/session.ts';
import './styles.css';

loadSession().catch(() => {
    currentUser.value = null;
});

const root = document.getElementById('app');
if (root) render(<App />, root);
