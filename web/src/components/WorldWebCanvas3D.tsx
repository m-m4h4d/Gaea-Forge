'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  CanvasNode,
  CanvasConnection,
  CanvasData,
  RelationshipType,
  LoreArticle,
} from '@/lib/database';
import NodeConnectModal from './NodeConnectModal';

interface WorldWebCanvas3DProps {
  canvasData: CanvasData;
  onChange: (updated: CanvasData) => void;
  articles: LoreArticle[];
  onOpenArticle: (articleId: string) => void;
  onSwitchTo2D: () => void;
}

const getTimestamp = () => Date.now();
const createUniqueId = (prefix: string) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

// Category Color Palette for 3D Stellar Bodies
const CATEGORY_COLORS: Record<string, { hex: number; css: string; emissive: number }> = {
  Characters: { hex: 0xf59e0b, css: '#f59e0b', emissive: 0xb45309 }, // Gold/Amber
  Locations: { hex: 0x10b981, css: '#10b981', emissive: 0x047857 }, // Emerald/Teal
  'Kingdoms & Factions': { hex: 0x8b5cf6, css: '#8b5cf6', emissive: 0x6d28d9 }, // Purple
  'Magic & Technology': { hex: 0x06b6d4, css: '#06b6d4', emissive: 0x0e7490 }, // Cyan
  Artifacts: { hex: 0xf43f5e, css: '#f43f5e', emissive: 0xbe123c }, // Rose/Ruby
  'Campaign Notes': { hex: 0x94a3b8, css: '#94a3b8', emissive: 0x475569 }, // Silver/Slate
};

const DEFAULT_COLOR = { hex: 0xe2e8f0, css: '#e2e8f0', emissive: 0x64748b };

export default function WorldWebCanvas3D({
  canvasData,
  onChange,
  articles,
  onOpenArticle,
  onSwitchTo2D,
}: WorldWebCanvas3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  // UI state
  const [hoveredNode, setHoveredNode] = useState<CanvasNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<CanvasNode | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const [isAutoRotating, setIsAutoRotating] = useState(true);

  // Connection modal state
  const [connectModalData, setConnectModalData] = useState<{
    isOpen: boolean;
    fromNodeId: string;
    toNodeId: string;
    existingConnectionId?: string;
    relationship?: RelationshipType;
    label?: string;
  } | null>(null);

  // Merge database articles into canvas nodes
  const nodes = useMemo(() => {
    const existingArticleIds = new Set(canvasData.nodes.map((n) => n.articleId).filter(Boolean));
    const newArticleNodes: CanvasNode[] = [];

    articles.forEach((art, idx) => {
      if (!existingArticleIds.has(art.id)) {
        // Distribute in a spherical orbit
        const phi = Math.acos(-1 + (2 * idx) / Math.max(1, articles.length));
        const theta = Math.sqrt(articles.length * Math.PI) * phi;
        const radius = 260 + (idx % 3) * 60;

        newArticleNodes.push({
          id: `node-art-${art.id}`,
          articleId: art.id,
          label: art.title,
          role: art.category,
          category: art.category,
          x: Math.round(550 + radius * Math.cos(theta) * Math.sin(phi)),
          y: Math.round(350 + radius * Math.sin(theta) * Math.sin(phi)),
          z: Math.round(radius * Math.cos(phi)),
        });
      }
    });

    return [...canvasData.nodes, ...newArticleNodes];
  }, [articles, canvasData.nodes]);

  // Three.js References
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const nodeMeshesRef = useRef<Map<string, THREE.Group>>(new Map());
  const linesGroupRef = useRef<THREE.Group | null>(null);
  const targetLookAtRef = useRef<THREE.Vector3 | null>(null);

  // 3D Space Coordinates converter from Node (x, y, z)
  const getNode3DPosition = useCallback((node: CanvasNode): THREE.Vector3 => {
    // Center at (0, 0, 0)
    const posX = (node.x - 550) * 0.8;
    const posY = -(node.y - 350) * 0.8;
    const posZ = (node.z !== undefined ? node.z : (Math.sin(node.x * 0.01) * 120)) * 0.8;
    return new THREE.Vector3(posX, posY, posZ);
  }, []);

  // Initialize Three.js Scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0d14);
    scene.fog = new THREE.FogExp2(0x0b0d14, 0.0008);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(55, width / height, 1, 4000);
    camera.position.set(0, 80, 580);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxDistance = 1400;
    controls.minDistance = 40;
    controls.autoRotate = isAutoRotating;
    controls.autoRotateSpeed = 0.6;
    controlsRef.current = controls;

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xf59e0b, 1.2);
    dirLight1.position.set(300, 400, 200);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x06b6d4, 1.0);
    dirLight2.position.set(-300, -200, -200);
    scene.add(dirLight2);

    // 6. Deep Space Background Starfield
    const starCount = 1800;
    const starGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);

    const starPalette = [
      new THREE.Color(0xffffff),
      new THREE.Color(0xf59e0b),
      new THREE.Color(0x06b6d4),
      new THREE.Color(0x8b5cf6),
    ];

    for (let i = 0; i < starCount; i++) {
      const radius = 900 + Math.random() * 800;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      starPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      starPositions[i * 3 + 2] = radius * Math.cos(phi);

      const col = starPalette[Math.floor(Math.random() * starPalette.length)];
      starColors[i * 3] = col.r;
      starColors[i * 3 + 1] = col.g;
      starColors[i * 3 + 2] = col.b;
    }

    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

    const starMat = new THREE.PointsMaterial({
      size: 2.2,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
    });

    const starPoints = new THREE.Points(starGeo, starMat);
    scene.add(starPoints);

    // Lines group
    const linesGroup = new THREE.Group();
    scene.add(linesGroup);
    linesGroupRef.current = linesGroup;

    // 7. Animation Loop
    let animationFrameId: number;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = (currentTime - startTime) * 0.001;

      // Smooth camera interpolation if target lookAt is set
      if (targetLookAtRef.current) {
        controls.target.lerp(targetLookAtRef.current, 0.08);
      }

      controls.update();

      // Subtle celestial rotation of background stars
      starPoints.rotation.y = elapsedTime * 0.015;

      // Pulse outer glow rings of nodes
      nodeMeshesRef.current.forEach((group) => {
        const ring = group.children[1];
        if (ring) {
          ring.rotation.z = elapsedTime * 0.4;
        }
      });

      renderer.render(scene, camera);
    };

    animationFrameId = requestAnimationFrame(animate);

    // 8. Resize Listener
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [getNode3DPosition, isAutoRotating]);

  // Update Auto-Rotate in Controls
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = isAutoRotating;
    }
  }, [isAutoRotating]);

  // Build / Rebuild Node Meshes & Constellation Beams in 3D Scene
  useEffect(() => {
    const scene = sceneRef.current;
    const linesGroup = linesGroupRef.current;
    if (!scene || !linesGroup) return;

    // Clear old node meshes
    nodeMeshesRef.current.forEach((mesh) => scene.remove(mesh));
    nodeMeshesRef.current.clear();

    // Clear old line meshes
    while (linesGroup.children.length > 0) {
      const child = linesGroup.children[0];
      linesGroup.remove(child);
    }

    const nodePositionsMap = new Map<string, THREE.Vector3>();

    // 1. Create 3D Meshes for Nodes
    nodes.forEach((node) => {
      const pos = getNode3DPosition(node);
      nodePositionsMap.set(node.id, pos);

      const colorData = CATEGORY_COLORS[node.category] || DEFAULT_COLOR;

      const group = new THREE.Group();
      group.position.copy(pos);

      // Core Stellar Sphere
      const sphereGeo = new THREE.SphereGeometry(7, 24, 24);
      const sphereMat = new THREE.MeshStandardMaterial({
        color: colorData.hex,
        emissive: colorData.emissive,
        emissiveIntensity: 0.9,
        roughness: 0.15,
        metalness: 0.7,
      });
      const sphere = new THREE.Mesh(sphereGeo, sphereMat);
      sphere.userData = { nodeId: node.id, node };
      group.add(sphere);

      // Orbit Glow Ring
      const ringGeo = new THREE.RingGeometry(9, 11, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: colorData.hex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.6,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      group.add(ring);

      scene.add(group);
      nodeMeshesRef.current.set(node.id, group);
    });

    // 2. Create 3D Constellation Beams for Connections
    canvasData.connections.forEach((conn) => {
      const posFrom = nodePositionsMap.get(conn.fromNodeId);
      const posTo = nodePositionsMap.get(conn.toNodeId);

      if (posFrom && posTo) {
        const points = [posFrom, posTo];
        const lineGeo = new THREE.BufferGeometry().setFromPoints(points);

        let lineColor = 0xd97706; // Default warm gold
        if (conn.relationship === 'parent-child') lineColor = 0x3b82f6; // Blue
        if (conn.relationship === 'spouse') lineColor = 0xec4899; // Pink
        if (conn.relationship === 'ally') lineColor = 0x10b981; // Green
        if (conn.relationship === 'rival') lineColor = 0xef4444; // Red
        if (conn.relationship === 'mentor') lineColor = 0x8b5cf6; // Purple

        const lineMat = new THREE.LineBasicMaterial({
          color: lineColor,
          transparent: true,
          opacity: 0.65,
          linewidth: 1.5,
        });

        const line = new THREE.Line(lineGeo, lineMat);
        line.userData = { connectionId: conn.id, fromId: conn.fromNodeId, toId: conn.toNodeId };
        linesGroup.add(line);
      }
    });
  }, [canvasData.connections, getNode3DPosition, nodes]);

  // Raycaster Mouse Hover & Click Interaction
  const handlePointerMove = (e: React.MouseEvent) => {
    const container = mountRef.current;
    const camera = cameraRef.current;
    if (!container || !camera) return;

    const rect = container.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    const interactiveObjects: THREE.Object3D[] = [];
    nodeMeshesRef.current.forEach((group) => {
      const sphere = group.children[0];
      if (sphere) interactiveObjects.push(sphere);
    });

    const intersects = raycaster.intersectObjects(interactiveObjects, false);

    if (intersects.length > 0) {
      const hitNode = intersects[0].object.userData.node as CanvasNode;
      setHoveredNode(hitNode);
      setHoverPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      container.style.cursor = 'pointer';
    } else {
      setHoveredNode(null);
      setHoverPos(null);
      container.style.cursor = 'grab';
    }
  };

  const handlePointerClick = () => {
    if (hoveredNode) {
      setSelectedNode(hoveredNode);

      // Focus camera smoothly on selected node
      const pos = getNode3DPosition(hoveredNode);
      targetLookAtRef.current = pos;

      if (cameraRef.current && controlsRef.current) {
        // Stop auto rotate on manual selection
        setIsAutoRotating(false);
      }
    } else {
      setSelectedNode(null);
    }
  };

  // Add Free Floating Node in 3D Space
  const handleAddFreeNode = () => {
    const newId = createUniqueId('node');
    const angle = Math.random() * Math.PI * 2;
    const distance = 160 + Math.random() * 120;

    const newNode: CanvasNode = {
      id: newId,
      label: 'New Celestial Node',
      role: 'Point of Interest',
      category: 'Locations',
      x: Math.round(550 + distance * Math.cos(angle)),
      y: Math.round(350 + distance * Math.sin(angle)),
      z: Math.round((Math.random() - 0.5) * 200),
    };

    onChange({
      ...canvasData,
      nodes: [...canvasData.nodes, newNode],
      last_updated: getTimestamp(),
    });
  };

  // Auto-Arrange Universe in 3D Spherical Fibonacci Lattice
  const handleAutoArrange3D = () => {
    if (nodes.length === 0) return;

    const updatedNodesMap = new Map<string, CanvasNode>();
    const count = nodes.length;

    nodes.forEach((node, idx) => {
      // Golden Spiral / Fibonacci Sphere distribution
      const phi = Math.acos(1 - (2 * (idx + 0.5)) / count);
      const theta = Math.PI * (1 + Math.sqrt(5)) * idx;
      const radius = 220 + Math.sqrt(idx + 1) * 35;

      const posX = radius * Math.sin(phi) * Math.cos(theta);
      const posY = radius * Math.sin(phi) * Math.sin(theta);
      const posZ = radius * Math.cos(phi);

      updatedNodesMap.set(node.id, {
        ...node,
        x: Math.round(550 + posX),
        y: Math.round(350 + posY),
        z: Math.round(posZ),
      });
    });

    const arrangedNodes = Array.from(updatedNodesMap.values());
    onChange({
      ...canvasData,
      nodes: arrangedNodes,
      last_updated: getTimestamp(),
    });

    // Reset camera target
    targetLookAtRef.current = new THREE.Vector3(0, 0, 0);
  };

  // Reset Camera View
  const handleResetCamera = () => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(0, 80, 580);
      controlsRef.current.target.set(0, 0, 0);
      targetLookAtRef.current = new THREE.Vector3(0, 0, 0);
      setSelectedNode(null);
      setIsAutoRotating(true);
    }
  };

  // Save Connection Modal
  const handleSaveConnection = (relationship: RelationshipType, label: string) => {
    if (!connectModalData) return;
    const { fromNodeId, toNodeId, existingConnectionId } = connectModalData;

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

    setConnectModalData(null);
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#07090e] text-parchment relative overflow-hidden select-none">
      {/* Top 3D Cosmos Toolbar */}
      <div className="bg-[#0e111a]/90 border-b border-slate-800/80 p-2.5 sm:p-3 flex items-center justify-between gap-2 shrink-0 z-30 backdrop-blur-md overflow-x-auto custom-scrollbar">
        {/* Left Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onSwitchTo2D}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-lg text-xs border border-slate-700 transition-colors flex items-center gap-1.5 shrink-0"
            title="Switch to 2D Constellation Map"
          >
            <span>🗺️</span> <span>2D Map</span>
          </button>

          <button
            onClick={handleAddFreeNode}
            className="px-3 py-1.5 bg-gold hover:bg-gold-hover text-slate-950 font-bold rounded-lg text-xs shadow-md shadow-gold/20 flex items-center gap-1 transition-all shrink-0"
          >
            <span>+</span> Add Celestial Star
          </button>

          <button
            onClick={handleAutoArrange3D}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-lg text-xs border border-slate-700 transition-colors flex items-center gap-1 shrink-0"
            title="Auto-arrange stellar bodies into spherical 3D cosmos"
          >
            <span>⚡</span> Auto-Arrange 3D Sphere
          </button>

          <span className="text-xs text-slate-400 font-medium ml-1 shrink-0 hidden sm:inline">
            <strong>{nodes.length}</strong> Celestial Bodies
          </span>
        </div>

        {/* Center Mode Tag */}
        <div className="hidden xl:flex items-center gap-2 px-3 py-1 bg-gold/10 border border-gold/30 rounded-full text-gold text-xs font-semibold shrink-0">
          <span className="w-2 h-2 rounded-full bg-gold animate-pulse" />
          <span>3D Cosmos Sphere Active</span>
        </div>

        {/* Right Camera & Orbit Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setIsAutoRotating(!isAutoRotating)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1 shrink-0 ${
              isAutoRotating
                ? 'bg-gold/20 border-gold text-gold shadow-sm shadow-gold/10'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle Cinematic Planetary Orbit"
          >
            <span>🌌</span> <span>{isAutoRotating ? 'Orbiting' : 'Orbit Pause'}</span>
          </button>

          <button
            onClick={handleResetCamera}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-lg text-xs font-medium transition-colors shrink-0"
            title="Reset Camera & Recenter"
          >
            Reset View
          </button>
        </div>
      </div>

      {/* 3D WebGL Canvas Container */}
      <div
        ref={mountRef}
        onMouseMove={handlePointerMove}
        onClick={handlePointerClick}
        className="flex-1 w-full h-full relative cursor-grab active:cursor-grabbing overflow-hidden"
      >
        {/* Floating Tooltip / HUD for Hovered Star */}
        {hoveredNode && hoverPos && !selectedNode && (
          <div
            style={{
              left: `${hoverPos.x + 14}px`,
              top: `${hoverPos.y - 14}px`,
            }}
            className="absolute pointer-events-none z-40 bg-slate-950/90 border border-gold/40 text-parchment p-3 rounded-xl shadow-2xl backdrop-blur-md transform -translate-y-full max-w-xs animate-in fade-in zoom-in-95 duration-100"
          >
            <div className="flex items-center gap-2 mb-1">
              <span
                className="w-3 h-3 rounded-full shadow-sm"
                style={{ backgroundColor: CATEGORY_COLORS[hoveredNode.category]?.css || '#f59e0b' }}
              />
              <span className="font-bold text-xs text-gold truncate">{hoveredNode.label}</span>
            </div>
            <div className="text-[10px] text-slate-400 font-medium">
              Category: <span className="text-slate-300">{hoveredNode.category}</span>
            </div>
            {hoveredNode.role && (
              <div className="text-[10px] text-slate-400 font-medium">
                Role: <span className="text-slate-300">{hoveredNode.role}</span>
              </div>
            )}
            <div className="mt-2 text-[10px] text-amber-300/80 font-mono flex items-center gap-1">
              <span>✦ Click to Inspect & Open Lore</span>
            </div>
          </div>
        )}

        {/* Selected Star Inspector Floating Card */}
        {selectedNode && (
          <div className="absolute top-4 right-4 z-40 bg-slate-950/95 border border-gold/50 rounded-2xl p-4 shadow-2xl backdrop-blur-xl w-72 text-parchment animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span
                  className="w-3.5 h-3.5 rounded-full ring-2 ring-gold/40"
                  style={{ backgroundColor: CATEGORY_COLORS[selectedNode.category]?.css || '#f59e0b' }}
                />
                <h3 className="font-bold text-sm text-gold truncate">{selectedNode.label}</h3>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-slate-500 hover:text-slate-300 text-xs p-1"
              >
                ✕
              </button>
            </div>

            <div className="py-3 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Category:</span>
                <span className="font-semibold text-slate-200">{selectedNode.category}</span>
              </div>
              {selectedNode.role && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Role / Type:</span>
                  <span className="font-semibold text-slate-200">{selectedNode.role}</span>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              {selectedNode.articleId && (
                <button
                  onClick={() => onOpenArticle(selectedNode.articleId!)}
                  className="w-full py-2 bg-gradient-to-r from-gold to-amber-500 hover:from-amber-400 hover:to-gold text-slate-950 font-bold rounded-lg text-xs shadow-md shadow-gold/20 flex items-center justify-center gap-1.5 transition-all"
                >
                  <span>📖</span> Open Lore in Editor
                </button>
              )}

              <button
                onClick={() => {
                  const targetNode = nodes.find((n) => n.id !== selectedNode.id);
                  if (targetNode) {
                    setConnectModalData({
                      isOpen: true,
                      fromNodeId: selectedNode.id,
                      toNodeId: targetNode.id,
                    });
                  }
                }}
                className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-lg text-xs border border-slate-700 flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>🔗</span> Link to Another Star
              </button>
            </div>
          </div>
        )}

        {/* Bottom Orbit Navigation Instructions */}
        <div className="absolute bottom-4 left-4 z-30 bg-slate-950/80 border border-slate-800/80 rounded-xl px-3 py-2 text-[11px] text-slate-400 backdrop-blur-md flex items-center gap-4">
          <span>🖱️ <strong>Left Click + Drag</strong> to Rotate</span>
          <span>•</span>
          <span>📜 <strong>Scroll</strong> to Zoom</span>
          <span>•</span>
          <span>🖐️ <strong>Right Click + Drag</strong> to Pan</span>
        </div>
      </div>

      {/* Node Connection Modal */}
      {connectModalData && (() => {
        const fromNode = nodes.find((n) => n.id === connectModalData.fromNodeId);
        const toNode = nodes.find((n) => n.id === connectModalData.toNodeId);

        return (
          <NodeConnectModal
            isOpen={connectModalData.isOpen}
            onClose={() => setConnectModalData(null)}
            fromName={fromNode?.label || 'Star 1'}
            toName={toNode?.label || 'Star 2'}
            initialRelationship={connectModalData.relationship}
            initialLabel={connectModalData.label}
            onSave={handleSaveConnection}
          />
        );
      })()}
    </div>
  );
}
