import { Handle, Position } from '@xyflow/react';

export default function GoalNode() {
  return (
    <div
      style={{
        width: 48,
        height: 48,
        borderRadius: '50%',
        backgroundColor: '#6366f1',
        border: '2px solid #4338ca',
      }}
    >
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}