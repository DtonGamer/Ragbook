# RAG Book Design System

## Overview
The RAG Book Design System is a comprehensive set of design guidelines, components, and patterns that ensure consistency and usability across the application. This system addresses the key pain points identified in the UX research report and provides a foundation for scalable, accessible, and user-friendly interfaces.

## Design Principles

### 1. Clarity Over Complexity
- Prioritize clear, simple interfaces that reduce cognitive load
- Use progressive disclosure to hide complex details until needed
- Ensure information hierarchy is visually apparent

### 2. Accessibility First
- All components must meet WCAG 2.1 AA standards
- Ensure sufficient color contrast (4.5:1 minimum)
- Provide keyboard navigation and screen reader support
- Support reduced motion preferences

### 3. Mobile-First Approach
- Design for mobile devices first, then enhance for larger screens
- Ensure touch targets are at least 44px
- Optimize navigation for thumb-friendly interactions
- Consider one-handed usage patterns

### 4. User Trust & Transparency
- Clearly communicate system status and processing states
- Provide clear source attribution for AI responses
- Show credit usage transparently
- Make error messages actionable

### 5. Seamless Onboarding
- Minimize friction in authentication and initial setup
- Provide guided onboarding for new users
- Show immediate value proposition
- Offer clear next steps

## Color Palette

### Primary Colors
- **Primary 500**: `hsl(263 70% 50%)` - Main brand color
- **Primary 400**: `hsl(263 70% 55%)` - Hover states
- **Primary 600**: `hsl(263 70% 45%)` - Active states
- **Primary 100**: `hsl(263 70% 85%)` - Backgrounds
- **Primary 900**: `hsl(263 70% 15%)` - Text on light backgrounds

### Secondary Colors
- **Secondary 400**: `hsl(217 91% 60%)` - Complementary brand color
- **Secondary 300**: `hsl(217 91% 65%)` - Hover states
- **Secondary 500**: `hsl(217 91% 50%)` - Active states

### Neutral Colors
- **Neutral 50**: `hsl(0 0% 98%)` - Light backgrounds
- **Neutral 100**: `hsl(0 0% 95%)` - Lighter backgrounds
- **Neutral 200**: `hsl(0 0% 90%)` - Subtle borders
- **Neutral 300**: `hsl(0 0% 80%)` - Light borders
- **Neutral 400**: `hsl(0 0% 65%)` - Medium text
- **Neutral 500**: `hsl(0 0% 50%)` - Placeholder text
- **Neutral 600**: `hsl(0 0% 40%)` - Secondary text
- **Neutral 700**: `hsl(0 0% 25%)` - Primary text on light
- **Neutral 800**: `hsl(0 0% 15%)` - Dark text
- **Neutral 900**: `hsl(0 0% 10%)` - Darker text

### Status Colors
- **Success 500**: `hsl(120 60% 40%)` - Success states
- **Warning 500**: `hsl(45 100% 50%)` - Warning states
- **Error 500**: `hsl(0 84.2% 45%)` - Error states
- **Info 500**: `hsl(200 100% 45%)` - Informational states

## Typography

### Font Families
- **Headings**: `var(--font-heading)` - Modern, clean typeface
- **Body**: `var(--font-body)` - Highly readable for long-form content

### Typography Scale
- **2xs**: 10px (0.625rem) - Captions, labels
- **xs**: 12px (0.75rem) - Small text, footnotes
- **sm**: 14px (0.875rem) - Secondary text, metadata
- **base**: 16px (1rem) - Default body text
- **lg**: 18px (1.125rem) - Secondary headings, emphasized text
- **xl**: 20px (1.25rem) - Primary headings
- **2xl**: 24px (1.5rem) - Section headings
- **3xl**: 30px (1.875rem) - Hero headings
- **4xl**: 36px (2.25rem) - Large hero headings

### Font Weights
- **Normal**: 400 - Default body text
- **Medium**: 500 - Emphasized text
- **Semibold**: 600 - Headings
- **Bold**: 700 - Strong emphasis

## Spacing System

### Base Unit
- 1 unit = 4px (0.25rem)

### Spacing Scale
- **0**: 0px (0rem)
- **1**: 4px (0.25rem) - Micro spacing
- **2**: 8px (0.5rem) - Small padding/margin
- **3**: 12px (0.75rem) - Medium padding/margin
- **4**: 16px (1rem) - Standard padding/margin
- **5**: 20px (1.25rem) - Larger padding/margin
- **6**: 24px (1.5rem) - Section spacing
- **8**: 32px (2rem) - Major section spacing
- **12**: 48px (3rem) - Large section spacing
- **16**: 64px (4rem) - Hero section spacing

## Component Specifications

### Buttons
Buttons are interactive elements that trigger actions or navigate users.

#### Variants
- **Primary**: Main call-to-action, uses primary color
- **Secondary**: Secondary actions, outlined or subtle
- **Destructive**: Actions that delete or modify data
- **Ghost**: Minimal styling for subtle actions
- **Link**: Text-styled buttons

#### Sizes
- **Small**: 32px height, for compact spaces
- **Medium**: 40px height, default size
- **Large**: 48px height, for important actions

#### States
- **Default**: Normal state
- **Hover**: Slight color variation and subtle scale
- **Active**: Pressed state with scale down
- **Focus**: Visible focus ring for accessibility
- **Disabled**: Reduced opacity, no interaction

### Inputs
Inputs allow users to enter and edit text.

#### Variants
- **Text**: Single line text input
- **Password**: Masked text input
- **Email**: Email validation
- **Textarea**: Multi-line text input

#### States
- **Default**: Normal state
- **Focus**: Highlighted border and subtle glow
- **Error**: Red border and error icon
- **Success**: Green border and success icon
- **Disabled**: Reduced opacity

### Cards
Cards group related information and content.

#### Variants
- **Default**: Basic card with border and padding
- **Elevated**: Shadow for emphasis
- **Filled**: Subtle background color
- **Interactive**: Hover state for clickable cards

### Badges
Badges highlight status or categorize content.

#### Variants
- **Default**: Neutral color
- **Primary**: Brand color
- **Secondary**: Secondary brand color
- **Success**: Success state
- **Warning**: Warning state
- **Destructive**: Error state
- **Outline**: Outlined variant

### Alerts
Alerts communicate important information to users.

#### Variants
- **Default**: Neutral information
- **Destructive**: Error or critical information
- **Success**: Positive confirmation
- **Warning**: Cautionary information
- **Info**: Informational content

## Accessibility Guidelines

### Color Contrast
- All text must have a contrast ratio of at least 4.5:1 against its background
- Large text (18px+) must have a contrast ratio of at least 3:1
- Non-text elements must have a contrast ratio of at least 3:1

### Keyboard Navigation
- All interactive elements must be focusable via keyboard
- Focus indicators must be visible and clear
- Tab order must follow logical reading flow
- Skip links should be provided for main content

### Screen Reader Support
- All interactive elements must have proper ARIA labels
- Semantic HTML elements should be used appropriately
- Complex components should have proper ARIA roles
- Status changes should be announced to screen readers

### Reduced Motion
- Animations should respect user's reduced motion preferences
- Motion should be subtle and purposeful
- No auto-playing animations
- Transitions should be smooth and not jarring

## Responsive Breakpoints

- **Mobile**: 0px - 639px
- **Tablet**: 640px - 767px
- **Desktop**: 768px - 1023px
- **Large Desktop**: 1024px+

## Interaction Design

### Micro-interactions
- Hover states should provide immediate feedback
- Loading states should be clear and informative
- Success states should be satisfying
- Error states should be helpful and actionable

### Animations
- Duration: 300ms for most transitions
- Easing: `cubic-bezier(0.4, 0.0, 0.2, 1)` for smooth transitions
- Purpose: To provide feedback and guide attention
- Respect: User's reduced motion preferences

### Loading States
- Skeleton screens for content loading
- Progress indicators for file uploads
- Clear status messages for processing
- Placeholder content for delayed loading

## Addressing UX Research Pain Points

### 1. Authentication Friction
- **Solution**: Streamlined authentication flow with social login options
- **Implementation**: Reduce CAPTCHA requirements, provide clear error messages
- **Design**: Clear form validation, remember me functionality

### 2. Credit System Limitations
- **Solution**: Transparent credit display with clear usage information
- **Implementation**: Credit usage history, upgrade prompts with clear benefits
- **Design**: Progress bars for credit usage, clear upgrade CTAs

### 3. Document Processing Complexity
- **Solution**: Clear status indicators with progress visualization
- **Implementation**: Real-time status updates, estimated processing times
- **Design**: Progress bars, status badges, clear error handling

### 4. Information Density in Chat Responses
- **Solution**: Progressive disclosure with collapsible sections
- **Implementation**: Default to simplified view, expand for details
- **Design**: Expandable sections, clear source attribution

### 5. Mobile Experience Gaps
- **Solution**: Mobile-optimized layouts and touch-friendly interactions
- **Implementation**: Bottom navigation, larger touch targets
- **Design**: Responsive layouts, thumb-friendly controls

### 6. Error Handling
- **Solution**: Clear, actionable error messages with recovery options
- **Implementation**: Specific error codes with help links
- **Design**: Friendly error illustrations, clear next steps

## Implementation Guidelines

### CSS Custom Properties
All design tokens should be implemented as CSS custom properties for consistency and theming:

```css
:root {
  --color-primary-500: hsl(263 70% 50%);
  --spacing-unit: 0.25rem;
  --radius-default: 0.5rem;
}
```

### Component Composition
- Use atomic design principles (atoms, molecules, organisms)
- Ensure components are composable and reusable
- Follow consistent naming conventions
- Document component APIs clearly

### Testing Considerations
- Test all components across all supported browsers
- Verify accessibility compliance with automated tools
- Test with real screen readers and keyboard-only navigation
- Validate responsive behavior across all breakpoints