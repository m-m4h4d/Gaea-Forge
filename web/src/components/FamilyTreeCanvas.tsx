'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  CanvasNode,
  CanvasConnection,
  CanvasData,
  RelationshipType,
  LoreArticle,
} from '@/lib/database';
import NodeConnectModal from './NodeConnectModal';

interface FamilyTreeCanvasProps {
  canvasData: CanvasData;
  onChange: (updated: CanvasData) => void;
  characterArticles: LoreArticle[];
}

const getTimestamp = () => Date.now();
const createUniqueId = (prefix: string) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

export default function FamilyTreeCanvas({
  canvasData,
  onChange,
  characterArticles,
}: FamilyTreeCanvasProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPanPos, setStartPanPos] = useState({ x: 0, y: 0 });

  // Local Nodes state for instant 60fps drag without batching delay
  const [nodes, setNodes] = useState<CanvasNode[]>(canvasData.nodes);

  // Sync internal nodes state when canvasData.nodes changes externally (and not dragging)
  const isDraggingRef = useRef(false);
  useEffect(() => {
    if (!isDraggingRef.current) {
      setNodes(canvasData.nodes);
    }
  }, [canvasData.nodes]);

  // Node Dragging State
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Line Drawing State (Connecting Handle)
  const [connectingFromNodeId, setConnectingFromNodeId] = useState<string | null>(null);
  const [mousePosCanvas, setMousePosCanvas] = useState({ x: 0, y: 0 });

  // Modals state
  const [activeConnectionModal, setActiveConnectionModal] = useState<{
    isOpen: boolean;
    fromNodeId: string;
    toNodeId: string;
    existingConnectionId?: string;
    relationship?: RelationshipType;
    label?: string;
  } | null>(null);

  // Rename / Edit Node Modal
  const [editingNode, setEditingNode] = useState<CanvasNode | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Convert Screen Coordinates to Canvas Coordinates
  const getCanvasCoords = useCallback(
    (clientX: number, clientY: number) => {
      if (!containerRef.current) return { x: 0, y: 0 };
      const rect = containerRef.current.getBoundingClientRect();
      const x = (clientX - rect.left - pan.x) / zoom;
      const y = (clientY - rect.top - pan.y) / zoom;
      return { x, y };
    },
    [pan, zoom]
  );

  // Pan Canvas Mouse Event Handlers
  const handleMouseDownBg = (e: React.MouseEvent) => {
    if (e.target !== containerRef.current && !(e.target as HTMLElement).classList.contains('canvas-bg')) return;
    setIsPanning(true);
    setStartPanPos({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const { x: cx, y: cy } = getCanvasCoords(e.clientX, e.clientY);
    setMousePosCanvas({ x: cx, y: cy });

    if (isPanning) {
      setPan({
        x: e.clientX - startPanPos.x,
        y: e.clientY - startPanPos.y,
      });
      return;
    }

    if (draggingNodeId) {
      const newX = Math.round(cx - dragOffset.x);
      const newY = Math.round(cy - dragOffset.y);

      // Instant synchronous local state update (0ms latency for nodes and connecting SVG lines)
      setNodes((prevNodes) =>
        prevNodes.map((node) => (node.id === draggingNodeId ? { ...node, x: newX, y: newY } : node))
      );
    }
  };

  const handleMouseUp = () => {
    if (draggingNodeId) {
      isDraggingRef.current = false;
      setDraggingNodeId(null);
      // Save updated nodes to parent canvasData
      onChange({
        ...canvasData,
        nodes: nodes,
        last_updated: getTimestamp(),
      });
    }
    setIsPanning(false);
  };

  // Node Drag Start
  const handleNodeMouseDown = (e: React.MouseEvent, node: CanvasNode) => {
    e.stopPropagation();
    if (connectingFromNodeId) {
      // Complete connection to this node if drawing line
      if (connectingFromNodeId !== node.id) {
        setActiveConnectionModal({
          isOpen: true,
          fromNodeId: connectingFromNodeId,
          toNodeId: node.id,
        });
      }
      setConnectingFromNodeId(null);
      return;
    }

    const { x: cx, y: cy } = getCanvasCoords(e.clientX, e.clientY);
    isDraggingRef.current = true;
    setDraggingNodeId(node.id);
    setDragOffset({ x: cx - node.x, y: cy - node.y });
  };

  // Start Drawing Connection Handle
  const handleStartConnect = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    setConnectingFromNodeId(nodeId);
  };

  // Save / Add Connection
  const handleSaveConnection = (relationship: RelationshipType, label: string) => {
    if (!activeConnectionModal) return;

    const { fromNodeId, toNodeId, existingConnectionId } = activeConnectionModal;

    let updatedConns = [...canvasData.connections];

    if (existingConnectionId) {
      updatedConns = updatedConns.map((c) =>
        c.id === existingConnectionId ? { ...c, relationship, label } : c
      );
    } else {
      const newConn: CanvasConnection = {
        id: createUniqueId('conn'),
        fromNodeId,
        toNodeId,
        relationship,
        label,
      };
      updatedConns.push(newConn);
    }

    onChange({
      ...canvasData,
      connections: updatedConns,
      last_updated: getTimestamp(),
    });

    setActiveConnectionModal(null);
  };

  // Delete Connection
  const handleDeleteConnection = (connId: string) => {
    const updatedConns = canvasData.connections.filter((c) => c.id !== connId);
    onChange({
      ...canvasData,
      connections: updatedConns,
      last_updated: getTimestamp(),
    });
  };

  // Add Node Relative to Parent (Child, Spouse, Parent, Sibling)
  const handleAddRelativeNode = (
    baseNode: CanvasNode,
    relType: 'child' | 'spouse' | 'parent' | 'sibling'
  ) => {
    const newId = createUniqueId('node');
    let newX = baseNode.x;
    let newY = baseNode.y;
    let defaultLabel = 'New Character';
    let relKey: RelationshipType = 'parent-child';
    let relLabel = 'Parent of';

    if (relType === 'child') {
      newX = baseNode.x;
      newY = baseNode.y + 180;
      defaultLabel = `Child of ${baseNode.label}`;
      relKey = 'parent-child';
      relLabel = 'Parent of';
    } else if (relType === 'spouse') {
      newX = baseNode.x + 280;
      newY = baseNode.y;
      defaultLabel = `Spouse of ${baseNode.label}`;
      relKey = 'spouse';
      relLabel = 'Spouse';
    } else if (relType === 'parent') {
      newX = baseNode.x;
      newY = baseNode.y - 180;
      defaultLabel = `Parent of ${baseNode.label}`;
      relKey = 'parent-child';
      relLabel = 'Parent of';
    } else if (relType === 'sibling') {
      newX = baseNode.x - 280;
      newY = baseNode.y;
      defaultLabel = `Sibling of ${baseNode.label}`;
      relKey = 'sibling';
      relLabel = 'Sibling to';
    }

    const newNode: CanvasNode = {
      id: newId,
      label: defaultLabel,
      role: 'Family Member',
      category: 'Characters',
      x: newX,
      y: newY,
    };

    let newConn: CanvasConnection | null = null;
    if (relType === 'parent') {
      newConn = {
        id: createUniqueId('conn'),
        fromNodeId: newId,
        toNodeId: baseNode.id,
        relationship: relKey,
        label: relLabel,
      };
    } else {
      newConn = {
        id: createUniqueId('conn'),
        fromNodeId: baseNode.id,
        toNodeId: newId,
        relationship: relKey,
        label: relLabel,
      };
    }

    const newNodes = [...nodes, newNode];
    setNodes(newNodes);

    onChange({
      ...canvasData,
      nodes: newNodes,
      connections: [...canvasData.connections, newConn],
      last_updated: getTimestamp(),
    });
  };

  // Add Free Node
  const handleAddFreeNode = () => {
    const newId = createUniqueId('node');
    const newNode: CanvasNode = {
      id: newId,
      label: 'New Character',
      role: 'Noble / Member',
      category: 'Characters',
      x: Math.round(-pan.x / zoom + 400),
      y: Math.round(-pan.y / zoom + 250),
    };

    const newNodes = [...nodes, newNode];
    setNodes(newNodes);

    onChange({
      ...canvasData,
      nodes: newNodes,
      last_updated: getTimestamp(),
    });
  };

  // Delete Node
  const handleDeleteNode = (nodeId: string) => {
    const updatedNodes = nodes.filter((n) => n.id !== nodeId);
    const updatedConns = canvasData.connections.filter(
      (c) => c.fromNodeId !== nodeId && c.toNodeId !== nodeId
    );

    setNodes(updatedNodes);
    onChange({
      ...canvasData,
      nodes: updatedNodes,
      connections: updatedConns,
      last_updated: getTimestamp(),
    });
  };

  // Save Edited Node
  const handleSaveNodeEdit = (nodeToEdit: CanvasNode) => {
    const updatedNodes = nodes.map((n) => (n.id === nodeToEdit.id ? nodeToEdit : n));
    setNodes(updatedNodes);
    onChange({
      ...canvasData,
      nodes: updatedNodes,
      last_updated: getTimestamp(),
    });
    setEditingNode(null);
  };

  // Smart Hierarchical Auto-arrange Algorithm
  const handleAutoArrange = () => {
    if (nodes.length === 0) return;

    // Build relationship maps
    const parentToChildren = new Map<string, string[]>();
    const spouseMap = new Map<string, string>();
    const childToParents = new Map<string, string[]>();

    canvasData.connections.forEach((c) => {
      if (c.relationship === 'parent-child') {
        const children = parentToChildren.get(c.fromNodeId) || [];
        children.push(c.toNodeId);
        parentToChildren.set(c.fromNodeId, children);

        const parents = childToParents.get(c.toNodeId) || [];
        parents.push(c.fromNodeId);
        childToParents.set(c.toNodeId, parents);
      } else if (c.relationship === 'spouse') {
        spouseMap.set(c.fromNodeId, c.toNodeId);
        spouseMap.set(c.toNodeId, c.fromNodeId);
      }
    });

    // Find root nodes (no parents)
    const roots = nodes.filter((n) => !childToParents.has(n.id));

    // Calculate level (Y depth) via BFS/DFS
    const nodeLevels = new Map<string, number>();
    const visited = new Set<string>();

    const assignLevel = (nodeId: string, level: number) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      nodeLevels.set(nodeId, level);

      // Spouse gets same level
      const spouseId = spouseMap.get(nodeId);
      if (spouseId && !visited.has(spouseId)) {
        assignLevel(spouseId, level);
      }

      // Children get level + 1
      const children = parentToChildren.get(nodeId) || [];
      children.forEach((childId) => {
        assignLevel(childId, level + 1);
      });
    };

    roots.forEach((root) => assignLevel(root.id, 0));

    // Assign level 0 to any remaining unvisited nodes
    nodes.forEach((n) => {
      if (!visited.has(n.id)) {
        assignLevel(n.id, 0);
      }
    });

    // Group node IDs by level
    const levelGroups = new Map<number, string[]>();
    nodeLevels.forEach((level, nodeId) => {
      const group = levelGroups.get(level) || [];
      group.push(nodeId);
      levelGroups.set(level, group);
    });

    // Compute (x, y) coordinates for each node
    const updatedNodesMap = new Map<string, CanvasNode>();
    nodes.forEach((n) => updatedNodesMap.set(n.id, { ...n }));

    levelGroups.forEach((nodeIds, level) => {
      const y = 100 + level * 220;
      const totalWidth = nodeIds.length * 280;
      const startX = 350 - totalWidth / 2;

      nodeIds.forEach((nodeId, idx) => {
        const node = updatedNodesMap.get(nodeId);
        if (node) {
          node.x = Math.round(startX + idx * 280);
          node.y = Math.round(y);
        }
      });
    });

    const arrangedNodes = Array.from(updatedNodesMap.values());

    setNodes(arrangedNodes);
    onChange({
      ...canvasData,
      nodes: arrangedNodes,
      last_updated: getTimestamp(),
    });
  };

  // Node Dimensions
  const NODE_WIDTH = 220;
  const NODE_HEIGHT = 100;

  return (
    <div className="w-full h-full flex flex-col bg-slate-950 text-parchment relative overflow-hidden select-none">
      {/* Canvas Top Controls Toolbar */}
      <div className="bg-slate-900/90 border-b border-slate-800 p-3 flex flex-wrap items-center justify-between gap-2 shrink-0 z-30 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <button
            onClick={handleAddFreeNode}
            className="px-3 py-1.5 bg-gold hover:bg-gold-hover text-slate-950 font-bold rounded-lg text-xs shadow-md shadow-gold/20 flex items-center gap-1 transition-all"
          >
            <span>+</span> Add Character Node
          </button>

          <button
            onClick={handleAutoArrange}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-lg text-xs border border-slate-700 transition-colors flex items-center gap-1"
            title="Auto-organize nodes by lineage hierarchy"
          >
            <span>⚡</span> Auto-Arrange Tree
          </button>
        </div>

        {/* Status / Instructions */}
        <div className="text-xs text-slate-400 hidden md:flex items-center gap-3">
          <span>💡 <em>Drag background to Pan</em></span>
          <span>•</span>
          <span><em>Drag handles to Connect characters</em></span>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg p-1">
          <button
            onClick={() => setZoom((z) => Math.max(0.4, z - 0.15))}
            className="w-7 h-7 flex items-center justify-center text-xs font-bold bg-slate-900 hover:bg-slate-800 rounded text-slate-300"
            title="Zoom Out"
          >
            -
          </button>
          <span className="text-xs font-mono px-2 text-gold">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(2.0, z + 0.15))}
            className="w-7 h-7 flex items-center justify-center text-xs font-bold bg-slate-900 hover:bg-slate-800 rounded text-slate-300"
            title="Zoom In"
          >
            +
          </button>
          <button
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            className="px-2 py-1 text-[10px] bg-slate-900 hover:bg-slate-800 rounded text-slate-400 font-medium"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Main Canvas Workspace Container */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDownBg}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        className="flex-1 relative cursor-grab active:cursor-grabbing overflow-hidden canvas-bg bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px]"
      >
        {/* Scaled Canvas World Layer */}
        <div
          className="absolute inset-0 origin-top-left pointer-events-none"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        >
          {/* SVG CONNECTOR LINES LAYER */}
          <svg className="absolute inset-0 w-[5000px] h-[5000px] pointer-events-none overflow-visible">
            <defs>
              <marker
                id="arrowhead"
                markerWidth="8"
                markerHeight="6"
                refX="7"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 8 3, 0 6" fill="#fbbf24" />
              </marker>
            </defs>

            {/* Rendered Connections */}
            {canvasData.connections.map((conn) => {
              const fromNode = nodes.find((n) => n.id === conn.fromNodeId);
              const toNode = nodes.find((n) => n.id === conn.toNodeId);
              if (!fromNode || !toNode) return null;

              const x1 = fromNode.x + NODE_WIDTH / 2;
              const y1 = fromNode.y + NODE_HEIGHT / 2;
              const x2 = toNode.x + NODE_WIDTH / 2;
              const y2 = toNode.y + NODE_HEIGHT / 2;

              const midX = (x1 + x2) / 2;
              const midY = (y1 + y2) / 2;

              // Smooth curve path
              const dy = y2 - y1;
              const curveX = midX;
              const curveY = midY - dy * 0.1;

              const pathString = `M ${x1} ${y1} Q ${curveX} ${curveY} ${x2} ${y2}`;

              // Color styles based on relationship
              let strokeColor = '#fbbf24'; // default gold
              if (conn.relationship === 'spouse') strokeColor = '#f43f5e'; // rose
              if (conn.relationship === 'sibling') strokeColor = '#38bdf8'; // sky blue
              if (conn.relationship === 'rival') strokeColor = '#ef4444'; // red
              if (conn.relationship === 'mentor') strokeColor = '#a855f7'; // purple

              return (
                <g key={conn.id} className="pointer-events-auto cursor-pointer group">
                  {/* Invisible thicker line for easy clicking */}
                  <path
                    d={pathString}
                    fill="none"
                    stroke="transparent"
                    strokeWidth="16"
                    onClick={() =>
                      setActiveConnectionModal({
                        isOpen: true,
                        fromNodeId: conn.fromNodeId,
                        toNodeId: conn.toNodeId,
                        existingConnectionId: conn.id,
                        relationship: conn.relationship,
                        label: conn.label,
                      })
                    }
                  />
                  {/* Visible Curve Path - No transition-all on d attribute for instant 0ms sync during node drag */}
                  <path
                    d={pathString}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth="2.5"
                    strokeDasharray={conn.relationship === 'rival' ? '6,4' : 'none'}
                    markerEnd="url(#arrowhead)"
                  />

                  {/* Relationship Label Pill */}
                  <g
                    transform={`translate(${midX}, ${midY})`}
                    onClick={() =>
                      setActiveConnectionModal({
                        isOpen: true,
                        fromNodeId: conn.fromNodeId,
                        toNodeId: conn.toNodeId,
                        existingConnectionId: conn.id,
                        relationship: conn.relationship,
                        label: conn.label,
                      })
                    }
                  >
                    <rect
                      x="-45"
                      y="-11"
                      width="90"
                      height="22"
                      rx="11"
                      fill="#0f172a"
                      stroke={strokeColor}
                      strokeWidth="1.5"
                      className="shadow-lg group-hover:fill-slate-800 transition-colors"
                    />
                    <text
                      x="0"
                      y="3"
                      textAnchor="middle"
                      fill="#fef3c7"
                      fontSize="9"
                      fontWeight="bold"
                    >
                      {conn.label || conn.relationship}
                    </text>
                  </g>
                </g>
              );
            })}

            {/* Drawing Line Preview while dragging handle */}
            {connectingFromNodeId && (() => {
              const fromNode = nodes.find((n) => n.id === connectingFromNodeId);
              if (!fromNode) return null;
              const x1 = fromNode.x + NODE_WIDTH / 2;
              const y1 = fromNode.y + NODE_HEIGHT / 2;
              return (
                <line
                  x1={x1}
                  y1={y1}
                  x2={mousePosCanvas.x}
                  y2={mousePosCanvas.y}
                  stroke="#fbbf24"
                  strokeWidth="2.5"
                  strokeDasharray="4,4"
                />
              );
            })()}
          </svg>

          {/* DRAGGABLE CHARACTER NODES LAYER */}
          {nodes.map((node) => {
            const isConnectingFrom = connectingFromNodeId === node.id;

            return (
              <div
                key={node.id}
                onMouseDown={(e) => handleNodeMouseDown(e, node)}
                style={{
                  left: `${node.x}px`,
                  top: `${node.y}px`,
                  width: `${NODE_WIDTH}px`,
                  height: `${NODE_HEIGHT}px`,
                }}
                className={`absolute pointer-events-auto rounded-xl p-3 bg-slate-900/90 border-2 shadow-2xl backdrop-blur-md flex flex-col justify-between group ${
                  isConnectingFrom
                    ? 'border-gold shadow-gold/30 ring-2 ring-gold/50'
                    : 'border-slate-800 hover:border-gold/60'
                }`}
              >
                {/* Node Top Row: Avatar & Labels */}
                <div className="flex items-start gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-slate-950 border border-gold/40 flex items-center justify-center text-lg shrink-0 shadow-inner overflow-hidden">
                    {node.avatarUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={node.avatarUrl} alt={node.label} className="w-full h-full object-cover" />
                    ) : (
                      <span>👤</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-xs text-parchment truncate">{node.label}</h4>
                    <p className="text-[10px] text-slate-400 truncate">{node.role || 'Character'}</p>
                  </div>

                  {/* Actions Dropdown / Edit */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingNode(node);
                    }}
                    className="text-slate-500 hover:text-gold text-xs px-1 rounded"
                    title="Edit character node details"
                  >
                    ✏️
                  </button>
                </div>

                {/* Node Bottom Quick Relatives Buttons */}
                <div className="flex items-center justify-between border-t border-slate-800/80 pt-1 text-[9px] text-slate-400">
                  <div className="flex gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddRelativeNode(node, 'child');
                      }}
                      className="px-1.5 py-0.5 bg-slate-950 hover:bg-slate-800 rounded text-slate-300 hover:text-gold"
                      title="Add Child node below"
                    >
                      + Child
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddRelativeNode(node, 'spouse');
                      }}
                      className="px-1.5 py-0.5 bg-slate-950 hover:bg-slate-800 rounded text-slate-300 hover:text-gold"
                      title="Add Spouse node"
                    >
                      + Spouse
                    </button>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteNode(node.id);
                    }}
                    className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete node"
                  >
                    ✕
                  </button>
                </div>

                {/* Connection Handle (Right Side Dot) */}
                <div
                  onMouseDown={(e) => handleStartConnect(e, node.id)}
                  className="absolute -right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 bg-gold rounded-full border-2 border-slate-950 flex items-center justify-center cursor-crosshair hover:scale-125 transition-transform shadow-md shadow-gold/40 text-slate-950 text-[10px] font-bold"
                  title="Drag from here to connect to another character"
                >
                  +
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* NODE CONNECT MODAL */}
      {activeConnectionModal && (() => {
        const fromNode = nodes.find((n) => n.id === activeConnectionModal.fromNodeId);
        const toNode = nodes.find((n) => n.id === activeConnectionModal.toNodeId);

        return (
          <NodeConnectModal
            isOpen={activeConnectionModal.isOpen}
            onClose={() => setActiveConnectionModal(null)}
            fromName={fromNode?.label || 'Character 1'}
            toName={toNode?.label || 'Character 2'}
            initialRelationship={activeConnectionModal.relationship}
            initialLabel={activeConnectionModal.label}
            onSave={handleSaveConnection}
            onDelete={
              activeConnectionModal.existingConnectionId
                ? () => handleDeleteConnection(activeConnectionModal.existingConnectionId!)
                : undefined
            }
          />
        );
      })()}

      {/* RENAME / EDIT NODE MODAL */}
      {editingNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 text-parchment">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4">
            <h3 className="font-bold text-gold text-sm">Edit Character Node</h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Character Name</label>
                <input
                  type="text"
                  value={editingNode.label}
                  onChange={(e) => setEditingNode({ ...editingNode, label: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-parchment focus:border-gold"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Title / Role</label>
                <input
                  type="text"
                  value={editingNode.role || ''}
                  onChange={(e) => setEditingNode({ ...editingNode, role: e.target.value })}
                  placeholder="e.g. High Archdruid, General"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-parchment focus:border-gold"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Link to Lore Article</label>
                <select
                  value={editingNode.articleId || ''}
                  onChange={(e) => {
                    const art = characterArticles.find((a) => a.id === e.target.value);
                    setEditingNode({
                      ...editingNode,
                      articleId: e.target.value || undefined,
                      label: art ? art.title : editingNode.label,
                    });
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-parchment focus:border-gold"
                >
                  <option value="">-- Custom Canvas Node --</option>
                  {characterArticles.map((art) => (
                    <option key={art.id} value={art.id}>
                      {art.title} ({art.category})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setEditingNode(null)}
                className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded text-xs"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSaveNodeEdit(editingNode)}
                className="px-4 py-1.5 bg-gold text-slate-950 font-bold rounded text-xs"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
