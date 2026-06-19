import { Handle, Position } from '@xyflow/react';;
import './Node.css';
import { type Objective, ObjectiveStatus } from '../../../Types/ObjectiveType';
import { useState } from 'react';
import ObjectiveCard from '../../UI/Objective/ObjectiveCard';

const STATUS_CYCLE = [
  ObjectiveStatus.Completed,
  ObjectiveStatus.Incomplete,
  ObjectiveStatus.Unknown,
];

export default function Objective({ data }: { data: Objective }) {
  const initialStatusIndex = STATUS_CYCLE.indexOf(data.status || ObjectiveStatus.Unknown);
  const [statusIndex, setStatusIndex] = useState(initialStatusIndex >= 0 ? initialStatusIndex : 2);
  const [isHovering, setIsHovering] = useState(false);

  const currentStatus = STATUS_CYCLE[statusIndex];

  const getStatusClass = () => {
    switch (currentStatus) {
      case ObjectiveStatus.Completed:
        return 'obj-circle-completed';
      case ObjectiveStatus.Incomplete:
        return 'obj-circle-incomplete';
      case ObjectiveStatus.Unknown:
        return 'obj-circle-unknown';
      default:
        return 'obj-circle-unknown';
    }
  };


  return (
    <div 
      className="obj-node" 
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      style={{ position: 'relative' }}
    >
      <Handle type="target" position={Position.Top} />
      <div 
        className={`obj-circle ${getStatusClass()}`} 
        style={{ cursor: 'pointer' }} 
      />
      <Handle type="source" position={Position.Bottom} />
      {isHovering && <ObjectiveCard data={data} />}
    </div>
  );
}
  