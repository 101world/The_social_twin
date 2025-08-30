# Macro Map of the Social Twin Page (`page.tsx`)

This document provides a high-level overview of the structure and key components in the `social-twin/page.tsx` file (located at `c:\app\my-ai-saas\my-ai-saas\app\social-twin\page.tsx`). The file is a large Next.js React component (8523 lines) that implements the main Social Twin interface, including chat, generation modes, and various UI elements. Below is a macro-level breakdown of the major sections, their purposes, and key features.

## 1. File Overview
- **Purpose**: Main page component for the Social Twin app, handling user interactions for text/image/video generation, chat, and project management.
- **Key Technologies**: Next.js (App Router), React, TypeScript, Tailwind CSS for styling.
- **State Management**: Extensive use of React hooks (useState, useEffect) for managing UI state, user data, and API interactions.
- **Key Dependencies**: Integrates with Supabase for data, Clerk for auth, and various AI services (e.g., Runpod, OpenAI).

## 2. Main Component Structure
The component is wrapped in a `PageContent` function that returns a `<main>` element with the following high-level layout:

### 2.1 Root Layout (`<main>`)
- **Purpose**: Container for the entire page, handling dark mode, mobile responsiveness, and overall styling.
- **Key Classes**: `relative w-screen overflow-hidden` with conditional dark mode styling.
- **Height**: Set to `100vh` for full-screen experience.
- **Children**:
  - Simple mode overlay (if enabled).
  - Main content sections (sidebar, chat area, etc.).

### 2.2 Sidebar Section
- **Purpose**: Left sidebar for navigation, user info, and app controls.
- **Conditional Rendering**: Only shown in non-simple mode; can be collapsed.
- **Key Features**:
  - User profile display.
  - Navigation tabs (e.g., chat, projects).
  - Settings and logout options.
- **Styling**: Fixed position, responsive width (240px when open).

### 2.3 Main Content Area (`<section>`)
- **Purpose**: Central area for chat and generation interfaces.
- **Layout**: Flex column with overflow handling.
- **Key Subsections**:
  - **Chat Area**: Displays messages, generations, and user interactions.
  - **Composer Section**: Input area for prompts, mode selectors, and action buttons.
  - **Modals and Overlays**: Various popups for settings, projects, etc.

## 3. Key Functional Sections

### 3.1 Chat Interface
- **Location**: Within the main content area, active when `activeTab === 'chat'`.
- **Purpose**: Handles real-time chat with AI, displaying messages and generation results.
- **Components**:
  - Message list with scrolling.
  - Generation cost display.
  - Attachment handling (images, videos, PDFs).
- **Features**:
  - Supports different modes (text, image, video).
  - Real-time updates via WebSocket or polling.
  - Error handling and loading states.

### 3.2 Composer Section
- **Location**: Bottom of the main content area (`composerRef`).
- **Purpose**: User input area for prompts, with controls for generation modes and attachments.
- **Key Elements**:
  - **Textarea**: Main input field for user prompts (responsive sizing, auto-resize).
  - **Mode Selectors**: Dropdowns for text/image/video modes, with mode-specific options (e.g., batch size, aspect ratio).
  - **Advanced Options Panel**: Expandable section for detailed settings (models, parameters, LoRAs, etc.).
  - **Buttons**:
    - Upload button (for files).
    - Send button (triggers generation).
    - Mobile-specific layout (buttons in bottom row).
    - Desktop-specific layout (buttons inline with textarea).
- **Conditional Rendering**:
  - Mobile: Buttons below textarea.
  - Desktop: Buttons inline to the right of textarea (recently updated for wider textarea).
- **Features**:
  - File processing (image resizing, PDF conversion).
  - Cost calculation and credit checks.
  - Keyboard shortcuts (Enter to send).

### 3.3 Advanced Options Panel
- **Purpose**: Detailed configuration for generations.
- **Trigger**: Toggled via `advancedOpen` state.
- **Sections**:
  - **Workflow & Model Selection**: Displays current workflow and provider options.
  - **Core Parameters**: Batch size, aspect ratio, steps, etc.
  - **Character & Style Control**: LoRA selections, strength sliders.
  - **Advanced Control**: Seed, denoise, negative prompts.
  - **Cost Summary**: Real-time cost calculation.
- **Styling**: Scrollable panel with gradient backgrounds for different modes.

### 3.4 Modals and Overlays
- **Purpose**: Handle secondary interactions without navigating away.
- **Key Modals**:
  - **Settings Modal**: User preferences, API keys, etc.
  - **Project Modal**: Save/load projects.
  - **Folder Modal**: Organize generations.
  - **Viewer Modal**: Display images/videos in full screen.
  - **PDF Editor**: Edit PDF attachments.
  - **Storyboard**: Plan video sequences.
  - **Library Modal**: Browse saved items.
  - **Delete Confirm**: Confirmation dialogs.
- **Conditional Rendering**: Based on state variables (e.g., `settingsOpen`, `projectModalOpen`).

## 4. State and Hooks
- **Key State Variables**:
  - `mode`: Current generation mode (text, image, etc.).
  - `input`: User prompt text.
  - `attached`: File attachment data.
  - `isMobile`: Responsive breakpoint detection.
  - `darkMode`: Theme toggle.
  - Various mode-specific states (e.g., `batchSize`, `aspectRatio`).
- **Hooks**:
  - `useState` for local state.
  - `useEffect` for side effects (e.g., loading data, WebSocket connections).
  - Custom hooks for auth, data fetching, and API calls.

## 5. Utility Functions and Constants
- **Constants**:
  - `BATCH_CHOICES`: Array of batch size options.
  - `AR_CHOICES`: Aspect ratio options.
  - `LORA_CHOICES`: Predefined LoRA models.
- **Functions**:
  - `handleSend`: Processes user input and triggers API calls.
  - File processing helpers (e.g., image resizing, PDF conversion).
  - Cost calculation logic.

## 6. Responsive Design
- **Mobile vs. Desktop**:
  - Mobile: Compact layout, buttons below textarea, touch-friendly controls.
  - Desktop: Inline buttons, wider textarea, advanced options in expandable panel.
- **Breakpoints**: Uses `isMobile` state for conditional rendering.

## 7. Integration Points
- **APIs**: Calls to Supabase for data, Runpod for generations, Clerk for auth.
- **External Services**: Razorpay for payments, Cloudflare R2 for storage.
- **WebSockets**: For real-time chat updates.

## 8. Recent Changes (from Context)
- **Desktop Composer Update**: Buttons now inline to the right of textarea for wider input area.
- **Removed Redundant Code**: Old separate desktop buttons block eliminated.
- **Lint Fixes**: Addressed ESLint issues for clean builds.

This map provides a high-level view; for detailed implementation, refer to specific sections of the file or use search tools for targeted code snippets. If you need a deeper dive into any section, let me know!

---

**Note for VS Code Agents**: Always review this macro map before making any edits to `page.tsx` to understand the overall structure, avoid breaking existing functionality, and ensure changes align with the component's architecture. Key areas to focus on: state management, responsive design, and integration points.
