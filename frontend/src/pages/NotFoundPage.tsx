import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div className="not-found">
      <span className="not-found-icon">
        <Compass size={28} />
      </span>
      <p className="eyebrow">404 · Off map</p>
      <h1>This location isn’t in the survey.</h1>
      <p>The page you followed doesn’t exist or the asset has been removed.</p>
      <Link to="/dashboard" className="btn btn-primary">
        Back to overview
      </Link>
    </div>
  );
}
