import { LocationProvider, Route, Router } from 'preact-iso';
import { HomePage } from './pages/HomePage.tsx';
import { NotFoundPage } from './pages/NotFoundPage.tsx';

export function App() {
    return (
        <LocationProvider>
            <Router>
                <Route path="/" component={HomePage} />
                <Route default component={NotFoundPage} />
            </Router>
        </LocationProvider>
    );
}
