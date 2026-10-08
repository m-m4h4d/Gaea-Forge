import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { disposeObject3D, removeAndDispose } from './threeDispose';

const meshWithTexture = () => {
  const texture = new THREE.Texture();
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1), new THREE.MeshStandardMaterial({ map: texture }));
  return { mesh, texture };
};

describe('disposeObject3D', () => {
  it('disposes geometries, materials and textures of nested objects', () => {
    const group = new THREE.Group();
    const { mesh, texture } = meshWithTexture();
    const line = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial());
    const inner = new THREE.Group();
    inner.add(line);
    group.add(mesh, inner);

    const spies = [
      vi.spyOn(mesh.geometry, 'dispose'),
      vi.spyOn(mesh.material, 'dispose'),
      vi.spyOn(texture, 'dispose'),
      vi.spyOn(line.geometry, 'dispose'),
      vi.spyOn(line.material, 'dispose'),
    ];
    expect(disposeObject3D(group)).toBe(2);
    spies.forEach((spy) => expect(spy).toHaveBeenCalledOnce());
  });

  it('handles material arrays', () => {
    const materials = [new THREE.MeshBasicMaterial(), new THREE.MeshBasicMaterial()];
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), materials);
    const spies = materials.map((m) => vi.spyOn(m, 'dispose'));
    disposeObject3D(mesh);
    spies.forEach((spy) => expect(spy).toHaveBeenCalledOnce());
  });
});

describe('removeAndDispose', () => {
  it('detaches the object from its parent and frees it', () => {
    const scene = new THREE.Scene();
    const { mesh } = meshWithTexture();
    scene.add(mesh);
    const spy = vi.spyOn(mesh.geometry, 'dispose');
    removeAndDispose(mesh);
    expect(scene.children).toHaveLength(0);
    expect(spy).toHaveBeenCalledOnce();
  });
});
