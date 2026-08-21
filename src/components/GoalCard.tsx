import './ObjectiveCard.css';
import { type Objective } from '../../../Types/ObjectiveType';

export default function ObjectiveCard({ data }: { data: Objective }) {
  return (
    <div className="objective-card">
      <div className="card-field">
        <span className="card-label">ID:</span>
        <span className="card-value">{data.id}</span>
      </div>
      <div className="card-field">
        <span className="card-label">Description:</span>
        <span className="card-value">{data.description}</span>
      </div>
      <div className="card-field">
        <span className="card-label">Deadline:</span>
        <span className="card-value">{data.deadline.toLocaleDateString()}</span>
      </div>
    </div>
  );
}
