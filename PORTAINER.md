# Portainer Deployment

## Prerequisites
- Portainer local instance running
- Stack deployment from Git repository enabled
- Image published in GHCR as `ghcr.io/<owner>/dembrandt:latest`

## Stack file
Use: `deploy/portainer-stack.yml`

## Deploy via Repository (recommended)
1. Go to **Stacks** > **Add stack**.
2. Choose **Repository**.
3. Set your Git URL.
4. Set **Compose path** to `deploy/portainer-stack.yml`.
5. Deploy the stack.

## Deploy via Web editor
1. Go to **Stacks** > **Add stack**.
2. Choose **Web editor**.
3. Paste the YAML from `deploy/portainer-stack.yml`.
4. Deploy the stack.

## If GHCR image is private
Configure GHCR auth in Portainer first:
1. Go to **Registries** > **Add registry**.
2. Choose **Custom registry** (or GitHub registry if your edition supports it).
3. Registry URL: `ghcr.io`
4. Username: your GitHub username
5. Password: GitHub PAT with at least `read:packages`
6. Save, then deploy the stack.

## Access
- UI + API: `http://<host>:3001`

## Persistence
Generated files are stored in Docker volume `dembrandt_output` at `/app/output` inside container.

## Notes
- Extraction runs with `--no-sandbox` by default in this web mode for container compatibility.
- If Playwright/browser startup issues happen in your host, keep `shm_size: 1gb` and do not remove it.
