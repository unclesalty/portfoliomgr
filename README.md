# Faye Portfolio Manager

A modern, client-side portfolio management application for tracking projects, resources, and timelines. Built with React 18, Vite, and Tailwind CSS 4.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)
![React](https://img.shields.io/badge/react-18.3.1-blue.svg)

---

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Building & Deployment](#building--deployment)
- [Extending the Application](#extending-the-application)
- [Configuration](#configuration)
- [Data Model](#data-model)
- [Contributing](#contributing)
- [Documentation](#documentation)

---

## Features

- **Interactive Gantt Chart** - Drag-and-drop project timeline management
- **Value Stream Organization** - Group projects by business value streams
- **Resource Planning** - Track and allocate resources across projects
- **Rocks Planning** - Quarterly goal tracking (EOS methodology)
- **Scenario Management** - Save and compare different portfolio scenarios
- **Import/Export** - JSON data export and Asana task import
- **PDF Export** - Generate timeline reports
- **Responsive Design** - Works on desktop and tablet devices

---

## Quick Start

### Prerequisites

- **Node.js** >= 20.0.0
- **npm** >= 10.0.0 (or pnpm >= 10.4.1)

### Installation

```bash
# Clone the repository
git clone https://github.com/unclesalty/portfoliomgr.git
cd portfoliomgr

# Install dependencies
npm install

# Start development server
npm run dev
```

The application will be available at `http://localhost:5173`

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint |

---

## Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (Client)                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   React     │  │  React      │  │    Radix UI + Shadcn    │  │
│  │   Router    │  │  18.x       │  │    Component Library    │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│                            │                                     │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    Application State                         ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   ││
│  │  │   Projects   │  │ ValueStreams │  │  ResourceTypes   │   ││
│  │  └──────────────┘  └──────────────┘  └──────────────────┘   ││
│  └─────────────────────────────────────────────────────────────┘│
│                            │                                     │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              Persistence Layer (localStorage)                ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   ││
│  │  │portfolioData │  │  scenarios   │  │     rocks        │   ││
│  │  └──────────────┘  └──────────────┘  └──────────────────┘   ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **UI Framework** | React 18.3 | Component-based UI |
| **Routing** | React Router DOM 7.x | Hash-based SPA routing |
| **Styling** | Tailwind CSS 4.x | Utility-first CSS |
| **Components** | Radix UI / shadcn/ui | Accessible component primitives |
| **Build Tool** | Vite 6.x | Fast dev server & bundler |
| **Charts** | Recharts | Data visualization |
| **Forms** | React Hook Form + Zod | Form handling & validation |
| **Date Handling** | date-fns | Date manipulation |
| **PDF Export** | jsPDF + html2canvas | Report generation |

### State Management

The application uses **React's built-in useState/useEffect hooks** for state management. State flows down from the main `PortfolioView` component:

```javascript
// Core application state (src/App.jsx)
const [projects, setProjects] = useState([]);
const [valueStreams, setValueStreams] = useState([]);
const [resourceTypes, setResourceTypes] = useState([]);
const [scenarioName, setScenarioName] = useState('Default');
```

**State Persistence:**
- Primary: `localStorage.portfolioData`
- Fallback: `sessionStorage.portfolioData`
- Scenarios: `localStorage.fayePortfolioScenario_${name}`

### Data Flow

```
User Action → Event Handler → State Update → Re-render → Auto-save to localStorage
                                    ↓
                            Child Components
```

---

## Project Structure

```
portfoliomgr/
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Pages deployment
├── dist/                       # Production build output
├── docs/                       # Documentation
│   └── security-analysis.md    # Security review
├── public/                     # Static assets
├── src/
│   ├── assets/                 # Images, icons
│   │   └── react.svg
│   ├── components/
│   │   ├── ui/                 # Shadcn/Radix UI components (40+)
│   │   │   ├── button.jsx
│   │   │   ├── card.jsx
│   │   │   ├── dialog.jsx
│   │   │   └── ...
│   │   ├── GanttChart.jsx      # Main timeline visualization
│   │   ├── ProjectForm.jsx     # Project CRUD form
│   │   ├── ResourceChart.jsx   # Resource allocation chart
│   │   ├── ResourcePlanningPanel.jsx
│   │   ├── RocksPlanning.jsx   # Quarterly rocks/goals
│   │   ├── ScenarioManager.jsx # Save/load scenarios
│   │   ├── SettingsPanel.jsx   # Value streams & resource config
│   │   ├── ValueStreamSidebar.jsx
│   │   └── ...
│   ├── data/
│   │   └── sampleData.js       # Demo/seed data
│   ├── hooks/
│   │   └── use-mobile.js       # Responsive hook
│   ├── lib/
│   │   └── utils.js            # Utility functions (cn, etc.)
│   ├── pages/
│   │   └── FilesPage.jsx       # File management view
│   ├── utils/
│   │   ├── resourceCalculator.js  # Resource/hours calculations
│   │   ├── scenarioManager.js     # Scenario CRUD operations
│   │   └── quarterlyView.js       # Quarterly data helpers
│   ├── App.jsx                 # Main application component
│   ├── App.css                 # Global styles & CSS variables
│   ├── index.css               # Tailwind imports
│   └── main.jsx                # React entry point
├── components.json             # Shadcn/ui configuration
├── eslint.config.js            # ESLint configuration
├── index.html                  # HTML entry point
├── jsconfig.json               # JS path aliases
├── package.json                # Dependencies & scripts
├── vite.config.js              # Vite configuration
└── README.md                   # This file
```

---

## Building & Deployment

### Local Development

```bash
npm run dev
```

Development server features:
- Hot Module Replacement (HMR)
- Runs on port 5173 (configurable)
- Opens browser automatically
- Source maps enabled

### Production Build

```bash
npm run build
```

Output is generated in `/dist` with:
- Minified JavaScript bundles
- CSS optimizations
- Asset hashing for cache busting
- Vendor chunk splitting (react-vendor)

### Deployment Options

#### GitHub Pages (Automated)

The repository includes automated deployment via GitHub Actions:

1. Push to `main` branch
2. GitHub Action builds and deploys to `gh-pages` branch
3. Available at `https://<username>.github.io/portfoliomgr/`

**Manual deployment:**
```bash
npm run build
# Push dist/ contents to gh-pages branch
```

#### Static Hosting (Netlify, Vercel, etc.)

```bash
npm run build
# Deploy the dist/ folder
```

**Build settings:**
- Build command: `npm run build`
- Publish directory: `dist`
- Node version: 20.x

#### Docker

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Environment Configuration

The base URL is configured in `vite.config.js`:

```javascript
base: process.env.NODE_ENV === 'production' ? '/portfoliomgr/' : '/',
```

For custom deployments, modify this value or use environment variables.

---

## Extending the Application

### Adding a New View/Page

1. **Create the component:**

```jsx
// src/components/MyNewView.jsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const MyNewView = ({ projects, valueStreams }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>My New View</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Your content */}
      </CardContent>
    </Card>
  );
};

export default MyNewView;
```

2. **Add navigation in App.jsx:**

```jsx
// Add to nav buttons
<Button 
  variant={currentView === 'my-new-view' ? 'secondary' : 'ghost'}
  onClick={() => setCurrentView('my-new-view')}
>
  <MyIcon className="h-4 w-4 sm:mr-2" />
  <span>My View</span>
</Button>

// Add to view rendering
{currentView === 'my-new-view' && (
  <MyNewView projects={projects} valueStreams={valueStreams} />
)}
```

### Adding a New UI Component

This project uses **shadcn/ui** components. To add new ones:

```bash
npx shadcn@latest add [component-name]
```

Or manually create in `src/components/ui/` following the existing patterns.

### Adding Data Fields

1. **Update the data model in `sampleData.js`:**

```javascript
export const projects = [
  {
    id: 'proj-001',
    name: 'Project Name',
    // Add your new field
    customField: 'value',
    ...
  }
];
```

2. **Update form handling in `ProjectForm.jsx`:**

```jsx
const [formData, setFormData] = useState({
  // Add new field
  customField: '',
  ...
});
```

3. **Update import/export in `App.jsx`:**

```javascript
const cleanData = {
  projects: data.projects.map(project => ({
    ...project,
    customField: String(project.customField || ''),
  })),
};
```

### Creating Custom Utilities

Add to `src/utils/`:

```javascript
// src/utils/myUtility.js
export function calculateSomething(projects, options) {
  // Your logic
  return result;
}
```

Import and use:
```javascript
import { calculateSomething } from '@/utils/myUtility';
```

### Styling Guidelines

- Use Tailwind CSS utility classes
- Custom CSS variables are defined in `src/App.css`
- Theme colors follow the Faye brand (purple primary)
- Use the `cn()` utility for conditional classes:

```jsx
import { cn } from '@/lib/utils';

<div className={cn(
  "base-classes",
  condition && "conditional-classes"
)} />
```

---

## Configuration

### Vite Configuration (`vite.config.js`)

```javascript
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),  // Path alias
    },
  },
  base: '/portfoliomgr/',  // Base URL for deployment
  server: {
    port: 5173,
    strictPort: true,
    host: true,
    open: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
});
```

### ESLint Configuration

The project uses ESLint 9 with flat config:

```javascript
// eslint.config.js
export default [
  { ignores: ['dist'] },
  {
    files: ['**/*.{js,jsx}'],
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      'react-refresh/only-export-components': ['warn'],
    },
  },
];
```

---

## Data Model

### Project

```typescript
interface Project {
  id: string;
  name: string;
  description: string;
  valueStreamId: string;
  startDate: string;          // ISO date string
  endDate: string;            // ISO date string
  status: 'planned' | 'in-progress' | 'completed' | 'on-hold' | 'at-risk' | 'delayed';
  priority: 'high' | 'medium' | 'low';
  progress: number;           // 0-100
  resources: {
    [resourceTypeId: string]: {
      required: number;
      allocated: number;
      hours: number;
    }
  };
  milestones: Milestone[];
  dependencies: string[];     // Project IDs
  asanaUrl?: string;
  hoursUsed: number;
  totalHours: number;
  simpleMode: boolean;
  estimatedHours: number;
  pmHours: number;
  pmAllocation: number;       // Percentage
  autoPopulatePM: boolean;
}
```

### Value Stream

```typescript
interface ValueStream {
  id: string;
  name: string;
  description: string;
  color: string;              // Hex color
  primaryStakeholder?: string;
  scorecardMetrics?: string;
}
```

### Resource Type

```typescript
interface ResourceType {
  id: string;
  name: string;
  hourlyRate: number;
  capacity: number;           // Number of people available
  color: string;              // Hex color
  isDefault?: boolean;
}
```

### Milestone

```typescript
interface Milestone {
  id: string;
  name: string;
  date: string;               // ISO date string
  status: 'planned' | 'in-progress' | 'completed';
  description?: string;
  linkedRockIds?: string[];
}
```

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Run linting: `npm run lint`
5. Commit with descriptive message
6. Push and create a Pull Request

### Code Style

- Use functional components with hooks
- Follow existing naming conventions
- Add JSDoc comments for complex functions
- Keep components focused and single-purpose

---

## Documentation

- [Security Analysis](./docs/security-analysis.md) - Security review and recommendations

---

## License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## Acknowledgments

- [Radix UI](https://www.radix-ui.com/) - Accessible component primitives
- [shadcn/ui](https://ui.shadcn.com/) - Component styling patterns
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [Vite](https://vitejs.dev/) - Next generation frontend tooling
