import { ReactFlow, Background, Controls, useReactFlow, useNodesState, useEdgesState, ReactFlowProvider, MarkerType } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useState, useCallback, useRef } from 'react';
import ObjectiveNode from '../components/Graph/Nodes/ObjectiveNode';
import { type Objective,  ObjectiveStatus } from '../Types/ObjectiveType';

const testObjectives: ObjectiveNode[] = [
  {
    description: 'Completed Objective',
    id: 1,
    subObjectives: [],
    deadline: new Date('2026-12-31'),
    status: ObjectiveStatus.Completed,
    
  },
  {
    description: 'Incomplete Objective',
    subObjectives: [],
    id: 2,
    deadline: new Date('2026-12-31'),
    status: ObjectiveStatus.Incomplete,
  },
  {
    description: 'Unknown Objective',
    subObjectives: [],
    id: 3,
    deadline: new Date('2026-12-31'),
    status: ObjectiveStatus.Unknown,
  },
];

const initialNodes = testObjectives.map((obj, index) => ({
  id: `${obj.id}`,
  type: 'obj',
  data: obj,
  position: { x: index * 150, y: 0 },
}));

const initialEdges = [];

const nodeTypes = {
    obj: ObjectiveNode
}


// later should take in initial nodes and edges from a json and appropriate width and height of viewport
function Flow() {
    
    
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
    const [nodeCount, setNodeCount] = useState(nodes.length+1)

    const connectingRef = useRef(false)


    const onConnect = useCallback((connection) => {
        // console.log(connection)
        const newEdge = {
            id: connection.source + "->" + connection.target,
            source: connection.source,
            target: connection.target
        }
        setEdges((eds) => [...eds, newEdge])
        
        setNodes((currentNodes) =>{
            const sourceNode = currentNodes.find(n=>n.id===connection.source)
            const targetNode = currentNodes.find(n=>n.id === connection.target)
            console.log(sourceNode)
            if (sourceNode && targetNode) {
                sourceNode.data.subObjectives = [...sourceNode.data.subObjectives, targetNode]
            }
            return currentNodes
        })
    
    }, [setEdges, setNodes])

    
    const onConnectStart = useCallback(() => {
        connectingRef.current = true
    }, [])

    const onConnectEnd = useCallback(() => {
        // Small delay so onPaneClick fires after this flag is set
        setTimeout(() => {
        connectingRef.current = false
        }, 100)
    }, [])

    const reactFlowInstance = useReactFlow();
    
    const onCanvasClick = (event) => {
        if (connectingRef.current) return


        const position = reactFlowInstance.screenToFlowPosition({x: event.clientX, y: event.clientY})
        // console.log(position)
        

        // Create a new node
        const newNode = {
            id: `${nodeCount}`,
            type: 'obj',
            data: {description: "default", id:`${nodeCount}`,  subObjectives: [], deadline: new Date(), status: ObjectiveStatus.Unknown},
            position: position,
        }
        

        setNodes((nds) => [...nds, newNode])
        // console.log(nodes)
        setNodeCount(nodeCount + 1)
    }


   

    return (
    <div style={{ height: '100vh', width: '100vw' }}>
        <ReactFlow nodes = {nodes} nodeTypes={nodeTypes} edges={edges} defaultEdgeOptions={{markerEnd: {type: MarkerType.ArrowClosed}}} onNodesChange={onNodesChange} onEdgesChange = {onEdgesChange} onConnect={onConnect} onConnectStart={onConnectStart} onConnectEnd={onConnectEnd} onPaneClick={onCanvasClick} fitView>
        <Background />
        <Controls />
        </ReactFlow>
    </div>
    );
}


function FlowWithProvider(){
    return (
        <ReactFlowProvider>
            <Flow/>
        </ReactFlowProvider>
    )    
}
export default FlowWithProvider
