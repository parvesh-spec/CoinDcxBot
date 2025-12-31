# Overview

This is a CoinDCX Telegram Bot Admin Dashboard - a full-stack web application that monitors cryptocurrency trades from the CoinDCX exchange and automatically posts formatted trade notifications to Telegram channels. The system provides an admin interface for managing message templates, monitoring trade history, and configuring Telegram channel integrations.

The application serves as a bridge between CoinDCX's trading API and Telegram's messaging platform, allowing users to automate trade notifications with customizable message templates and real-time monitoring capabilities.

## Recent Changes (September 2025)

**V2 5-Field Target Status System Migration - COMPLETED ✅**
- Successfully migrated from legacy 3-field target system to sophisticated 5-field system
- Implemented intelligent cascade rules and auto-completion logic for enhanced trade management
- All components (backend, frontend, database, automations) fully updated and operational
- Real-time trading activity verified working perfectly with V2 system

**Professional Trade History Header - COMPLETED ✅**
- Added professional header with Campus For Wisdom logo to trade history page
- Implemented "Join Free Community" CTA button linking to Telegram community (telegram.me/campusforwisdom)
- Enhanced layout with improved statistics display and responsive design
- Fixed stop loss functionality to properly trigger trade completion instead of target status update

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **UI Library**: Radix UI components with shadcn/ui design system
- **Styling**: Tailwind CSS with CSS variables for theming
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Form Handling**: React Hook Form with Zod validation via @hookform/resolvers

## Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **Authentication**: Replit Auth with OpenID Connect (OIDC)
- **Session Management**: Express sessions with PostgreSQL session store
- **API Design**: RESTful API with express routing

## Database Schema
The PostgreSQL database uses the following key entities:
- **Users**: Stores user authentication data from Replit Auth
- **Telegram Channels**: Configuration for target Telegram channels
- **Message Templates**: Customizable message formats for trade notifications
- **Trades**: Historical record of all processed trades with status tracking
- **Sessions**: Express session storage for authentication

## Authentication & Authorization
- **Provider**: Replit Auth using OpenID Connect
- **Session Storage**: PostgreSQL-backed sessions with connect-pg-simple
- **Security**: HTTPS-only cookies, session TTL management
- **User Management**: Automatic user creation/updates via OIDC claims

## Trade Monitoring System
- **Architecture**: Cron-based scheduled monitoring service
- **Data Flow**: CoinDCX API → Trade Processing → Database Storage → Telegram Posting
- **Error Handling**: Retry mechanisms with status tracking (pending, posted, failed)
- **Rate Limiting**: Configurable intervals to respect API limits

## Message Template System
- **Variable Substitution**: Dynamic placeholder replacement (e.g., {pair}, {price}, {quantity})
- **Field Filtering**: Configurable inclusion/exclusion of trade data fields
- **Preview System**: Real-time template preview with sample data
- **Channel Association**: Templates can be linked to specific Telegram channels

# External Dependencies

## Database
- **Neon Database**: Serverless PostgreSQL hosting via @neondatabase/serverless
- **Connection**: WebSocket-based connection with connection pooling

## Cryptocurrency Exchange
- **CoinDCX API**: REST API for fetching trade data and account information
- **Authentication**: API key and secret-based authentication
- **Rate Limits**: Configurable request throttling to respect exchange limits

## Messaging Platform
- **Telegram Bot API**: HTTP-based API for sending messages to channels
- **Authentication**: Bot token-based authentication
- **Message Formatting**: HTML and Markdown support for rich text formatting

## Development & Build Tools
- **Vite**: Frontend build tool with HMR and development server
- **Replit Integration**: Custom plugins for development environment integration
- **TypeScript**: Type checking and compilation across frontend and backend
- **ESBuild**: Backend bundling for production deployment

## UI Component Libraries
- **Radix UI**: Headless UI primitives for accessibility and behavior
- **Lucide React**: Icon library for consistent iconography
- **Tailwind CSS**: Utility-first CSS framework with custom design tokens
