# RAG Book High-Fidelity Mockups

## Overview
This document provides detailed specifications for high-fidelity mockups of the RAG Book application screens. Each mockup addresses specific pain points identified in the UX research report and follows the design system guidelines.

## 1. Home/Landing Page

### 1.1 Desktop Mockup Specifications

#### Layout Structure:
- **Header**: Fixed top navigation with logo, navigation links, and CTA buttons
- **Hero Section**: Centered content with headline, subheading, and primary CTAs
- **Preview Section**: Visual representation of the chat interface
- **Footer**: Copyright and basic links

#### Visual Elements:
- **Background**: Subtle gradient mesh pattern with 50% opacity
- **Logo**: RAG BOOK text with gradient from primary to secondary color
- **Headline**: "Recall faster with an AI that understands your notes" - 4xl font size
- **Subheading**: "Natural conversation. Clear explanations. Searches your documents only when you ask." - lg font size
- **CTA Buttons**: 
  - Primary: "Get started — it's free" with hover scale effect
  - Secondary: "Sign in" outlined button
- **Preview Card**: Simulated chat interface showing AI response

#### Interaction Specifications:
- **Get Started Button**: Navigates to authentication page
- **Sign In Button**: Navigates to sign in page
- **Pricing Link**: Navigates to pricing page
- **Hover Effects**: Subtle scale and shadow on interactive elements

#### Responsive Behavior:
- **Desktop**: Full-width layout with centered content
- **Tablet**: Adjusted spacing and font sizes
- **Mobile**: Single column layout with adjusted padding

### 1.2 Mobile Mockup Specifications

#### Layout Structure:
- **Header**: Collapsed navigation with hamburger menu
- **Hero Section**: Vertical layout with centered content
- **Preview Section**: Full-width preview card
- **Footer**: Simplified footer

#### Visual Elements:
- **Headline**: Adjusted to 2xl font size
- **Subheading**: Adjusted to base font size
- **CTA Buttons**: Stacked vertically with appropriate spacing
- **Spacing**: Increased padding for mobile touch targets

## 2. Authentication Pages

### 2.1 Sign In/Up Page Mockup Specifications

#### Layout Structure:
- **Background**: Gradient mesh overlay with 50% opacity
- **Card**: Centered authentication card with tabs
- **Form**: Email and password inputs with CAPTCHA
- **Navigation**: Tabs for switching between sign in and sign up

#### Visual Elements:
- **Card**: Semi-transparent background with backdrop blur
- **Tabs**: Two tabs for sign in and sign up
- **Inputs**: Labeled text inputs with proper spacing
- **CAPTCHA**: Centered widget below form fields
- **Buttons**: Primary action button with loading state
- **Links**: Secondary links for password reset and social options

#### Interaction Specifications:
- **Tab Switching**: Smooth transition between sign in and sign up
- **Form Validation**: Real-time validation with visual feedback
- **Loading States**: Button shows loading indicator during submission
- **Error Handling**: Clear error messages below form fields

#### Addressing UX Pain Points:
- **Reduced Friction**: Streamlined form with clear validation
- **CAPTCHA Integration**: Positioned to not overwhelm the form
- **Clear Feedback**: Immediate response to user actions

### 2.2 Password Reset Page Mockup Specifications

#### Layout Structure:
- **Background**: Consistent with authentication page
- **Card**: Focused form for password reset
- **Form**: Email input with CAPTCHA
- **Navigation**: Back to sign in link

#### Visual Elements:
- **Icon**: Mail icon for visual context
- **Headline**: Clear instruction for password reset
- **Inputs**: Email field with proper labeling
- **CTA**: Primary button for sending reset link

## 3. Dashboard/Chat Page

### 3.1 Desktop Mockup Specifications

#### Layout Structure:
- **Sidebar**: Collapsible navigation panel (280px wide when expanded)
- **Main Content**: Chat interface with messages and input
- **Header**: Fixed top bar with user controls
- **Input Area**: Fixed bottom input area

#### Sidebar Components:
- **Header**: Logo and user profile
- **Navigation**: Links to Chat, Documents, Pricing
- **Credits Display**: Current credit count with progress bar
- **System Memory**: AI learning indicators
- **User Actions**: Documents, Pricing, Settings, Sign Out

#### Main Content Components:
- **Messages Area**: Scrollable area with alternating user/assistant messages
- **Message Structure**:
  - User messages: Right-aligned with primary background
  - Assistant messages: Left-aligned in card with expandable sections
  - Sources: Expandable section showing document sources
  - Decision Factors: Expandable section showing AI reasoning
- **Input Area**: Text area with send button and instructions

#### Visual Elements:
- **Background**: Consistent with design system
- **Message Cards**: Clear visual distinction between user and assistant
- **Progress Indicators**: Animated dots for assistant typing
- **Expandable Sections**: Clear indicators for additional information

#### Interaction Specifications:
- **Sidebar Toggle**: Collapsible with smooth animation
- **Message Expansion**: Click to expand technical details
- **Input Behavior**: Multi-line with Shift+Enter, Send with Enter
- **Scrolling**: Auto-scroll to new messages

#### Addressing UX Pain Points:
- **Information Density**: Progressive disclosure for technical details
- **Mobile Experience**: Optimized sidebar behavior
- **Error Handling**: Clear error states in messages

### 3.2 Mobile Mockup Specifications

#### Layout Structure:
- **Bottom Navigation**: Fixed bottom bar with navigation icons
- **Main Content**: Chat messages with input
- **Header**: Collapsible top bar with minimal controls

#### Visual Elements:
- **Navigation**: Icon-based bottom navigation
- **Messages**: Full-width with appropriate spacing
- **Input**: Optimized for mobile touch targets
- **Spacing**: Increased padding for mobile comfort

#### Interaction Specifications:
- **Navigation**: Tap to switch between sections
- **Message Expansion**: Tap to expand technical details
- **Input Focus**: Adjusts layout when keyboard appears

## 4. Documents Page

### 4.1 Desktop Mockup Specifications

#### Layout Structure:
- **Header**: Breadcrumb navigation and page title
- **Stats Cards**: Grid of 4 cards showing document statistics
- **Search and Filters**: Search bar with action buttons
- **Documents Grid**: Grid of document cards
- **Upload Modal**: Overlay form for document upload

#### Stats Cards:
- **Total Documents**: Count of uploaded documents
- **Knowledge Chunks**: Total chunks in knowledge base
- **Total Size**: Combined size of all documents
- **Last Upload**: Date of most recent upload

#### Document Card Components:
- **Icon**: File type icon (PDF, DOC, etc.)
- **Name**: Document name with truncation
- **Status**: Badge showing processing status
- **Metadata**: File size, upload date, chunk count
- **Actions**: Process, download, delete buttons

#### Visual Elements:
- **Grid Layout**: Responsive grid adjusting to screen size
- **Status Colors**: Color-coded status badges
- **Action Buttons**: Consistent button styles
- **Empty State**: Clear message when no documents exist

#### Interaction Specifications:
- **Upload Button**: Opens modal for document upload
- **Process Button**: Initiates document processing
- **Delete Button**: Confirmation dialog before deletion
- **Download Button**: Initiates file download
- **Search**: Real-time filtering of documents

#### Addressing UX Pain Points:
- **Document Processing**: Clear status indicators and progress
- **Information Organization**: Structured document display
- **Error Handling**: Clear error messages for failed documents

### 4.2 Mobile Mockup Specifications

#### Layout Structure:
- **Header**: Simplified navigation with back button
- **Stats Cards**: Vertical stack of information
- **Search and Actions**: Optimized for mobile width
- **Documents List**: Vertical list instead of grid
- **Floating Action Button**: Quick access to upload

#### Visual Elements:
- **List Layout**: Single column for better readability
- **Touch Targets**: Larger buttons for easier interaction
- **Spacing**: Increased padding for mobile comfort

#### Interaction Specifications:
- **Swipe Actions**: Swipe to reveal additional options
- **Long Press**: Context menu for additional actions
- **Pull to Refresh**: Refresh document list

## 5. Pricing Page

### 5.1 Desktop Mockup Specifications

#### Layout Structure:
- **Header**: Simple back navigation
- **Current Usage**: Card showing current credit usage
- **Pricing Cards**: Side-by-side comparison of plans
- **Features List**: Detailed feature comparison
- **Footer**: Additional information

#### Pricing Card Components:
- **Free Plan**: Basic features with clear limitations
- **Pro Plan**: Enhanced features with clear benefits
- **Highlight**: Pro plan highlighted as recommended
- **CTA Buttons**: Upgrade buttons with appropriate states

#### Visual Elements:
- **Card Design**: Clean cards with subtle shadows
- **Highlight**: Recommended plan with border accent
- **Feature Icons**: Checkmarks for included features
- **Progress Bar**: Visual representation of credit usage

#### Interaction Specifications:
- **Upgrade Button**: Initiates Paystack payment flow
- **Current Plan**: Disabled for active plan
- **Hover Effects**: Subtle animations on cards
- **Loading States**: Payment processing indicators

#### Addressing UX Pain Points:
- **Credit System**: Clear visualization of credit usage
- **Value Proposition**: Clear benefits of Pro plan
- **Pricing Transparency**: All costs clearly displayed

### 5.2 Mobile Mockup Specifications

#### Layout Structure:
- **Stacked Cards**: Vertical layout of pricing options
- **Simplified Features**: Prioritized feature list
- **Mobile-Optimized CTAs**: Larger touch targets

#### Visual Elements:
- **Card Stacking**: Single column layout
- **Touch Targets**: Larger buttons for easier interaction
- **Spacing**: Increased padding for mobile comfort

## 6. Error and Empty States

### 6.1 Error Pages Mockup Specifications

#### Layout Structure:
- **Centered Content**: Error illustration and message
- **Clear Instructions**: What went wrong and what to do
- **Navigation Options**: Links to other sections

#### Visual Elements:
- **Illustration**: Friendly error illustration
- **Headline**: Clear error description
- **Subtext**: Detailed explanation
- **Buttons**: Primary action to resolve error

### 6.2 Empty States Mockup Specifications

#### Layout Structure:
- **Centered Content**: Illustration and encouraging message
- **Clear CTA**: Primary action to add content
- **Secondary Options**: Alternative actions

#### Visual Elements:
- **Illustration**: Context-appropriate illustration
- **Headline**: Encouraging message
- **Subtext**: Brief explanation
- **CTA Button**: Primary action button

## 7. Micro-interactions and Animations

### 7.1 Loading States
- **Skeleton Screens**: For content loading
- **Progress Indicators**: For file uploads
- **Animated Dots**: For AI responses
- **Subtle Animations**: For state changes

### 7.2 Feedback Animations
- **Button Press**: Subtle scale and color change
- **Success States**: Checkmark animations
- **Error States**: Shake animation for form errors
- **Hover Effects**: Subtle scale on interactive elements

## 8. Accessibility Considerations

### 8.1 Visual Accessibility
- **Color Contrast**: All elements meet WCAG 2.1 AA standards
- **Focus Indicators**: Clear and visible for keyboard navigation
- **Text Scaling**: Proper behavior with text scaling

### 8.2 Interaction Accessibility
- **Keyboard Navigation**: All functionality available via keyboard
- **Screen Reader Support**: Proper ARIA labels and roles
- **Reduced Motion**: Respects user motion preferences

## 9. Responsive Breakpoints

### 9.1 Mobile (0px - 639px)
- **Layout**: Single column, bottom navigation
- **Touch Targets**: Minimum 44px for all interactive elements
- **Spacing**: Increased padding for mobile comfort
- **Typography**: Adjusted for mobile readability

### 9.2 Tablet (640px - 1023px)
- **Layout**: Adjusted sidebar behavior
- **Grids**: Reduced columns in grid layouts
- **Spacing**: Balanced spacing for medium screens

### 9.3 Desktop (1024px+)
- **Layout**: Full sidebar navigation
- **Grids**: Multi-column layouts
- **Interactions**: Hover states and tooltips

## 10. Implementation Guidelines

These mockups should be implemented with attention to:
- Consistency with the design system
- Proper spacing and typography
- Appropriate color usage
- Clear visual hierarchy
- Responsive behavior
- Accessibility compliance
- Performance optimization

The mockups address all key pain points identified in the UX research report while maintaining a clean, modern aesthetic that supports the educational purpose of the application.