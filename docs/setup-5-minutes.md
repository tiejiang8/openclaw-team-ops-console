# 5-Minute Setup Guide

Get the OpenClaw Team Ops Console running in less than 5 minutes.

## Prerequisites
- Node.js 18+
- pnpm 8+
- (Optional) Docker & Docker Compose

## Step 1: Install Dependencies
```bash
corepack pnpm install
```

## Step 2: Configure Environment
Copy the example environment file:
```bash
cp .env.example .env
```
By default, the console starts in **mock mode**, so you don't need a real OpenClaw runtime to see it in action.

## Step 3: Start the Console
```bash
corepack pnpm dev
```
Open your browser at:
- **Web UI**: [http://localhost:5173](http://localhost:5173)
- **API**: [http://localhost:4300](http://localhost:4300)

## Step 4: Connect to a Real Runtime (Optional)
If you have a local OpenClaw runtime, update `.env`:
```env
OPENCLAW_STATE_DIR=/home/user/.openclaw
```
Then restart the dev server. The console will now read your real configuration, agents, and logs in **strict read-only mode**.

## Troubleshooting
- **Port Conflict**: Update `OVERLAY_WEB_PORT` or `OVERLAY_API_PORT` in `.env`.
- **Permission Denied**: Ensure you have read access to your OpenClaw state directory.
