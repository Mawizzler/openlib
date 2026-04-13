# OpenLib Architecture

## Overview
OpenLib follows a light clean-architecture split to keep OPAC data access, app logic, and UI concerns separated. The intent is to keep domain types stable while allowing adapters (OPAC, caching, future APIs) to evolve independently.

## Layers
- Domain (`src/domain`): Stable models and value types shared across the app.
- Application (`src/application`): Interfaces (ports) and use cases that describe what the app does.
- Infrastructure (`src/infrastructure`): Adapters that implement application ports (OPAC, storage, analytics).
- Presentation (`src/presentation`): Navigation and UI composition.

## Dependency Rule
Dependencies flow inward:
- Presentation depends on Application and Domain.
- Infrastructure depends on Application and Domain.
- Domain depends on nothing else.

## OPAC Integration
- Core OPAC models live in `src/domain/models/opac.ts`.
- The OPAC port lives in `src/application/ports/OpacAdapter.ts`.
- Concrete adapters live in `src/infrastructure/opac/` (currently a stub).

## Navigation
`src/presentation/navigation/` holds navigation types and a placeholder `AppNavigator`. When wiring real routes, replace the placeholder with a navigation library and map the route types to actual screens.
