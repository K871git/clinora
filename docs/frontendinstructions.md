# Clinora — Frontend Instructions

Build Clinora as a **simple, elegant, professional, and highly usable offline-first EMR frontend** for a real doctor.

## Core Principles

* Prioritize **simplicity, clarity, speed, and reliability**.
* UI/UX should feel **better and more polished than typical EMR applications** while remaining practical.
* Create an **immersive, calm, modern healthcare experience** — never flashy or unnecessarily complex.
* Minimize clicks, typing, navigation, and cognitive load for the doctor.
* Design around the real workflow:
  **Patient → Visit → Prescription → Print → Pharmacy → Completion → History**
* Support **Light and Dark modes**.
* Default theme must be **System**.
* Keep UI consistent across all pages, forms, tables, modals, and states.
* Handle loading, empty, validation, success, and error states properly.

## Code Principles

* Use **React + JavaScript + Vite**.
* Write **simple, readable, maintainable code**.
* Prefer straightforward solutions over clever abstractions.
* Avoid unnecessary libraries, components, patterns, and complexity.
* Keep components reasonably sized and reusable where reuse is meaningful.
* Code should be **easy for another developer to understand, debug, modify, and deploy**.
* Never sacrifice reliability or data integrity for UI effects.

## Product Boundary

Frontend communicates only with the **Laravel REST API**.

Do not add:

* AI
* unnecessary realtime/WebSockets
* cloud dependencies
* unnecessary third-party services
* unrelated EMR features

Before implementing anything, understand the existing backend API and preserve the established Clinora architecture and scope.
