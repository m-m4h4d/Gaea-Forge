# ⚙️ Claude Setup & Directives

## Project Name

Gaea Forge

## Project Overview

"Gaea Forge" is a professional-grade SaaS platform dedicated to digital landscape and architectural design. It functions as a collaborative digital workbench where 3D models, textures, GIS data, and biome data converge to create immersive, realistic virtual environments.

The platform emphasizes:

- **Precision Engineering**: Accuracy in cartography, biome simulation, and material science.
- **Scalable Infrastructure**: Handling large datasets (GIS, BIM) and high-fidelity rendering.
- **Creative Flexibility**: Allowing users to sculpt terrain, customize biomes, and generate detailed architectural assets.

## Core Modules

### 1. GIS Engine & Terrain Module

- **Function**: Processes high-resolution cartographic data to generate base topography and georeferenced terrain.
- **Key Features**: DEM/DTM import, fault-line generation, river simulation, and climate modeling.

### 2. Biome Layering System

- **Function**: Defines environmental rules for vegetation, hydrology, and material distribution.
- **Key Features**: Procedural biomes (temperate, arid, tundra), erosion simulation, and ecological zone mapping.

### 3. Asset Foundry

- **Function**: A repository of 3D models, materials, and textures for populating scenes.
- **Key Features**: PBR material library, procedural texture generation, and asset fusion engine.

### 4. Interactive Workspace

- **Function**: The primary creative interface where users sculpt, paint, and compose environments.
- **Key Features**: Brush-based editing, layer management, and real-time preview rendering.

### 5. Backend & GIS Orchestration

- **Function**: Manages data pipelines, spatial queries, and simulation state.
- **Key Features**: GeoServer integration, PostgreSQL/PostGIS, Celery task queue, and file management.

## Development Style & Guidelines

Claude must strictly adhere to the following development principles:

### 1. Clean Architecture (Hexagonal/Onion)

- **Isolation**: Separate concerns between the core engine, business logic, and external services.
- **Dependency Rules**: Dependencies flow inward from infrastructure to the core domain.

### 2. API-First Design

- **API Contracts**: All services must be exposed via clear, versioned REST or GraphQL APIs.
- **Idempotency**: Critical operations (e.g., terrain modification, asset placement) must be idempotent.

### 3. GIS Purity

- **Coordinate Systems**: All geographic data must maintain proper CRS (Coordinate Reference System) context.
- **Data Integrity**: "No data loss" principle. Vector and raster data must be preserved or losslessly converted.

### 4. Asset Pipeline Excellence

- **Material Science**: Materials must be PBR-compliant (Albedo, Roughness, Metallic, Normal).
- **Procedural Consistency**: Procedural generation should be deterministic and editable.

## Directives for Claude

### 1. Project Orientation

- **Perspective**: The codebase reflects a blend of high-performance gaming engines (for the workspace) and robust enterprise infrastructure (for GIS data handling).
- **Tone**: Professional, precise, engineering-focused.

### 2. Code Quality Standards

- **DRY**: Avoid code duplication, especially in geometric or shader logic.
- **Type Safety**: Strict type checking is mandatory. Avoid `any` types.
- **Error Handling**: Graceful degradation during simulation. Provide actionable error messages for GIS data issues.

### 3. Design & Implementation Guidelines

- **Modularity**: Components should be highly modular and independently testable.
- **Extensibility**: The architecture must allow for the easy addition of new biome types, rendering shaders, or asset libraries.

### 4. Data Handling

- **Spatial Indexing**: When implementing search or query features, use spatial indexing (e.g., R-trees).
- **Version Control**: Maintain strict versioning for large dataset schemas.

### 5. Documentation

- **Docstrings**: Every public interface must be documented.
- **Flow Diagrams**: For complex operations like biome generation or terrain sculpting, create visual flow diagrams.

@AGENTS.md
