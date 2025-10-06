# Logo Setup Instructions

## Required Action

Please save the Arbitrage logo image to this directory with one of these filenames:

- `arbitrage-logo.svg` (recommended - vector format)
- `arbitrage-logo.png` (alternative - raster format)

## Steps to Add the Logo

1. Save the logo image file to: `c:\arbitrage\web\frontend\public\`
2. Name it: `arbitrage-logo.svg` or `arbitrage-logo.png`
3. Restart the Next.js development server if it's running

## Current Implementation

The Topbar component has been updated to display the logo at the top left with:
- **Height**: 32px (h-8)
- **Width**: Auto-scaled to maintain aspect ratio
- **Fallback**: If the image fails to load, it shows "Arbitrage Pro" text

## Alternative: Using PNG Format

If you want to use PNG format instead, update the Topbar.tsx file:

Change:
```tsx
src="/arbitrage-logo.svg"
```

To:
```tsx
src="/arbitrage-logo.png"
```

## Logo Specifications

For best results, the logo should be:
- **Format**: SVG (preferred) or PNG with transparent background
- **Dimensions**: At least 200px height for crisp display
- **Colors**: The logo already has cyan/blue colors that match the app theme
