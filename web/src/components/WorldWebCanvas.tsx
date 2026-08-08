'use client';

import React, { useState, useMemo, useRef, useCallback } from 'react';
import {
  CanvasNode,
  CanvasConnection,
  CanvasData,
  RelationshipType,
  LoreArticle,
} from '@/lib/database';
import NodeConnectModal from './NodeConnectModal';

interface WorldWebCanvasProps {
  canvasData: CanvasData;
  onChange: (updated: CanvasData) => void;
  articles: LoreArticle[];
  onOpenArticle: (articleId: string) => void;
}

const getTimestamp = () => Date.now();
const createUniqueId = (prefix: string) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

export default function WorldWebCanvas({
  canvasData,
  onChange,
  articles,
  onOpenArticle,
}: WorldWebCanvasProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPanPos, setStartPanPos] = useState({ x: 0, y: 0 });

  // Hovered node state for constellation highlight
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Drag positions map for instant 60fps drag
  const [dragPositions, setDragPositions] = useState<Record<string, { x: number; y: number }>>({});

  // Merge database articles into canvas nodes purely via useMemo
  const baseNodes = useMemo(() => {
    const existingNodeArticleIds = new Set(canvasData.nodes.map((n) => n.articleId).filter(Boolean));
    const newArticleNodes: CanvasNode[] = [];

    articles.forEach((art, idx) => {
      if (!existingNodeArticleIds.has(art.id)) {
        const angle = (idx / Math.max(1, articles.length)) * 2 * Math.PI;
        const radius = 240 + (idx % 4) * 80;
        newArticleNodes.push({
          id: `node-art-${art.id}`,
          articleId: art.id,
          label: art.title,
          role: art.category,
          category: art.category,
          x: Math.round(550 + radius * Math.cos(angle)),
          y: Math.round(350 + radius * Math.sin(angle)),
        });
      }
    });

    return [...canvasData.nodes, ...newArticleNodes];
  }, [articles, canvasData.nodes]);

  // Effective nodes combining base positions with local drag overrides
  const nodes = useMemo(() => {
    return baseNodes.map((node) => {
      const pos = dragPositions[node.id];
      return pos ? { ...node, x: pos.x, y: pos.y } : node;
    });
  }, [baseNodes, dragPositions]);

  // Drag state
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Connection handle state
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

      setDragPositions((prev) => ({
        ...prev,
        [draggingNodeId]: { x: newX, y: newY },
      }));
    }
  };

  const handleMouseUp = () => {
    if (draggingNodeId) {
      setDraggingNodeId(null);
      onChange({
        ...canvasData,
        nodes,
        last_updated: getTimestamp(),
      });
    }
    setIsPanning(false);
  };

  // Node Drag Start
  const handleNodeMouseDown = (e: React.MouseEvent, node: CanvasNode) => {
    e.stopPropagation();
    if (connectingFromNodeId) {
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
    setDraggingNodeId(node.id);
    setDragOffset({ x: cx - node.x, y: cy - node.y });
  };

  // Add Free Floating Point Node
  const handleAddFreeNode = () => {
    const newId = createUniqueId('node-web');
    const newNode: CanvasNode = {
      id: newId,
      label: 'New Concept',
      category: 'General',
      x: Math.round(-pan.x / zoom + 450),
      y: Math.round(-pan.y / zoom + 300),
    };

    const updatedNodes = [...nodes, newNode];

    onChange({
      ...canvasData,
      nodes: updatedNodes,
      last_updated: getTimestamp(),
    });
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

  // Auto-arrange Constellation Points in space
  const handleAutoArrangeWeb = () => {
    if (nodes.length === 0) return;

    const centerPoint = { x: 600, y: 350 };
    const updatedNodesMap = new Map<string, CanvasNode>();

    nodes.forEach((node, idx) => {
      const phi = (1 + Math.sqrt(5)) / 2;
      const angle = 2 * Math.PI * idx * phi;
      const radius = 120 + Math.sqrt(idx + 1) * 75;

      updatedNodesMap.set(node.id, {
        ...node,
        x: Math.round(centerPoint.x + radius * Math.cos(angle)),
        y: Math.round(centerPoint.y + radius * Math.sin(angle)),
      });
    });

    const arrangedNodes = Array.from(updatedNodesMap.values());
    setDragPositions({});
    onChange({
      ...canvasData,
      nodes: arrangedNodes,
      last_updated: getTimestamp(),
    });
  };

  // Highlight connections connected to hovered node
  const connectedNodeIds = new Set<string>();
  if (hoveredNodeId) {
    connectedNodeIds.add(hoveredNodeId);
    canvasData.connections.forEach((c) => {
      if (c.fromNodeId === hoveredNodeId) connectedNodeIds.add(c.toNodeId);
      if (c.toNodeId === hoveredNodeId) connectedNodeIds.add(c.fromNodeId);
    });
  }

  return (
    <div className="w-full h-full flex flex-col bg-[#111216] text-parchment relative overflow-hidden select-none">
      {/* Top Toolbar */}
      <div className="bg-[#18191e]/90 border-b border-slate-800/80 p-3 flex flex-wrap items-center justify-between gap-2 shrink-0 z-30 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <button
            onClick={handleAddFreeNode}
            className="px-3 py-1.5 bg-gold hover:bg-gold-hover text-slate-950 font-bold rounded-lg text-xs shadow-md shadow-gold/20 flex items-center gap-1 transition-all"
          >
            <span>+</span> Add Floating Node
          </button>
          <button
            onClick={handleAutoArrangeWeb}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-lg text-xs border border-slate-700 transition-colors flex items-center gap-1"
          >
            <span>⚡</span> Auto-Arrange Constellation
          </button>
          <span className="text-xs text-slate-400 font-medium ml-2">
            <strong>{nodes.length}</strong> Floating Points
          </span>
        </div>

        <div className="text-xs text-slate-400 hidden md:flex items-center gap-3">
          <span>💡 <em>Click any point/label to open Lore</em></span>
          <span>•</span>
          <span><em>Drag ring to connect points</em></span>
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
          <span className="text-xs font-mono px-2 text-gold">{Math.round(zoom * 100)}%</span>
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

      {/* Main Space Workspace Container */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDownBg}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        className="flex-1 relative cursor-grab active:cursor-grabbing overflow-hidden canvas-bg bg-[#111216]"
      >
        <div
          className="absolute inset-0 origin-top-left pointer-events-none"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        >
          {/* SVG CONSTELLATION LINES LAYER */}
          <svg className="absolute inset-0 w-[5000px] h-[5000px] pointer-events-none overflow-visible">
            {canvasData.connections.map((conn) => {
              const fromNode = nodes.find((n) => n.id === conn.fromNodeId);
              const toNode = nodes.find((n) => n.id === conn.toNodeId);
              if (!fromNode || !toNode) return null;

              const isHighlighted =
                hoveredNodeId === conn.fromNodeId || hoveredNodeId === conn.toNodeId;

              return (
                <g key={conn.id} className="pointer-events-auto cursor-pointer group">
                  {/* Clickable Area */}
                  <line
                    x1={fromNode.x}
                    y1={fromNode.y}
                    x2={toNode.x}
                    y2={toNode.y}
                    stroke="transparent"
                    strokeWidth="14"
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
                  {/* Constellation Link Line */}
                  <line
                    x1={fromNode.x}
                    y1={fromNode.y}
                    x2={toNode.x}
                    y2={toNode.y}
                    stroke={isHighlighted ? '#fbbf24' : '#475569'}
                    strokeOpacity={isHighlighted ? 0.9 : 0.45}
                    strokeWidth={isHighlighted ? 2.5 : 1.5}
                    className="transition-colors duration-150"
                  />
                </g>
              );
            })}

            {/* Drag Line Preview */}
            {connectingFromNodeId && (() => {
              const fromNode = nodes.find((n) => n.id === connectingFromNodeId);
              if (!fromNode) return null;
              return (
                <line
                  x1={fromNode.x}
                  y1={fromNode.y}
                  x2={mousePosCanvas.x}
                  y2={mousePosCanvas.y}
                  stroke="#fbbf24"
                  strokeWidth="2"
                  strokeDasharray="4,4"
                />
              );
            })()}
          </svg>

          {/* FLOATING POINT NODES & LABELS LAYER */}
          {nodes.map((node) => {
            const isHovered = hoveredNodeId === node.id;
            const isConnectedToHovered = connectedNodeIds.has(node.id);
            const isConnectingFrom = connectingFromNodeId === node.id;

            return (
              <div
                key={node.id}
                onMouseDown={(e) => handleNodeMouseDown(e, node)}
                onMouseEnter={() => setHoveredNodeId(node.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
                style={{
                  left: `${node.x}px`,
                  top: `${node.y}px`,
                }}
                className="absolute pointer-events-auto transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group cursor-pointer"
              >
                {/* Floating Glowing Point Circle */}
                <div
                  className={`w-4 h-4 rounded-full border-2 transition-all duration-150 relative flex items-center justify-center ${
                    isHovered || isConnectingFrom
                      ? 'bg-gold border-amber-300 scale-150 shadow-xl shadow-gold/60 ring-4 ring-gold/30'
                      : isConnectedToHovered
                      ? 'bg-amber-300 border-gold scale-125 shadow-lg shadow-gold/40'
                      : 'bg-slate-300 border-slate-400 shadow-md shadow-white/10 group-hover:bg-gold group-hover:border-amber-300 group-hover:scale-125'
                  }`}
                >
                  {/* Connection Drag Ring Handle (Visible on hover) */}
                  <div
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setConnectingFromNodeId(node.id);
                    }}
                    className="absolute -inset-2.5 rounded-full border border-gold/0 group-hover:border-gold/60 group-hover:scale-110 transition-all cursor-crosshair"
                    title="Drag to connect to another point"
                  />
                </div>

                {/* Floating Text Label below the point */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    if (node.articleId) {
                      onOpenArticle(node.articleId);
                    }
                  }}
                  className="mt-2 text-center text-xs font-medium tracking-wide whitespace-nowrap drop-shadow-md select-none transition-colors"
                >
                  <span
                    className={`${
                      isHovered || isConnectingFrom
                        ? 'text-gold font-bold underline'
                        : isConnectedToHovered
                        ? 'text-parchment font-semibold'
                        : 'text-slate-200 group-hover:text-gold'
                    }`}
                  >
                    {node.label}
                  </span>
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
            fromName={fromNode?.label || 'Point 1'}
            toName={toNode?.label || 'Point 2'}
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
    </div>
  );
}
