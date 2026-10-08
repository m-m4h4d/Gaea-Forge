// Three.js keeps geometries, materials and textures in GPU memory until they are
// disposed explicitly; removing an object from its scene does not free them.
import type { Material, Object3D, Texture } from 'three';

function disposeMaterial(material: Material) {
  // Free any textures the material holds (maps, normal maps, ...)
  for (const value of Object.values(material)) {
    if (value && typeof value === 'object' && (value as Texture).isTexture) (value as Texture).dispose();
  }
  material.dispose();
}

// Dispose the GPU resources of an object and everything below it.
// Returns how many geometries were disposed.
export function disposeObject3D(root: Object3D): number {
  let geometries = 0;
  root.traverse((obj) => {
    const { geometry, material } = obj as Object3D & { geometry?: { dispose(): void }; material?: Material | Material[] };
    if (geometry) {
      geometry.dispose();
      geometries++;
    }
    if (Array.isArray(material)) material.forEach(disposeMaterial);
    else if (material) disposeMaterial(material);
  });
  return geometries;
}

// Remove an object from its parent and free its GPU resources
export function removeAndDispose(obj: Object3D): void {
  obj.removeFromParent();
  disposeObject3D(obj);
}
