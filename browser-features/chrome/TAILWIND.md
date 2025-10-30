# Tailwind CSS v4 Setup

This directory now has Tailwind CSS v4 support.

## Files Added

- `vite.config.ts` - Vite configuration with @tailwindcss/vite plugin
- `utils/tailwind.css` - CSS entry point with @import "tailwindcss"
- `package.json` - Package metadata
- Updated `deno.json` with Tailwind CSS dependencies

## Usage

To use Tailwind CSS in your components:

1. Import the CSS file in your TypeScript/JavaScript entry:

   ```typescript
   import "./utils/tailwind.css";
   ```

2. Use Tailwind utility classes in your components:
   ```tsx
   <div class="bg-blue-500 text-white p-4">
     <h1 class="text-2xl font-bold">Hello Tailwind!</h1>
   </div>
   ```

## Dependencies

The following npm packages are configured in `deno.json`:

- `tailwindcss@^4.1.16`
- `@tailwindcss/vite@^4.1.16`

These packages are also available in the root `package.json` for the entire project.
