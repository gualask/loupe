import { LocationProvider, Route, Router } from 'preact-iso';
import { RequireUser } from './components/RequireUser.tsx';
import { AccountLinkPage } from './pages/AccountLinkPage.tsx';
import { AdminUsersPage } from './pages/AdminUsersPage.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { MockupPage } from './pages/MockupPage.tsx';
import { NotFoundPage } from './pages/NotFoundPage.tsx';
import { ProjectPage } from './pages/ProjectPage.tsx';
import { ViewerPage } from './pages/ViewerPage.tsx';

const Home = () => (
    <RequireUser>
        <HomePage />
    </RequireUser>
);

const Project = () => (
    <RequireUser>
        <ProjectPage />
    </RequireUser>
);

const Mockup = () => (
    <RequireUser>
        <MockupPage />
    </RequireUser>
);

const AdminUsers = () => (
    <RequireUser admin>
        <AdminUsersPage />
    </RequireUser>
);

export function App() {
    return (
        <LocationProvider>
            <Router>
                <Route path="/" component={Home} />
                <Route path="/projects/:id" component={Project} />
                <Route path="/mockups/:id" component={Mockup} />
                <Route path="/admin/users" component={AdminUsers} />
                <Route path="/s/:token" component={ViewerPage} />
                <Route path="/login" component={LoginPage} />
                <Route path="/setup/:token" component={AccountLinkPage} />
                <Route path="/invite/:token" component={AccountLinkPage} />
                <Route path="/reset/:token" component={AccountLinkPage} />
                <Route default component={NotFoundPage} />
            </Router>
        </LocationProvider>
    );
}
